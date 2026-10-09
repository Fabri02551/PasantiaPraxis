// Package admin siembra la cuenta administradora del CRM.
//
// El ETL la asegura en cada corrida: si el correo no existe, crea la persona
// y el usuario con rol admin y contraseña aleatoria; si ya existe, no toca su
// contraseña (para no pisar la que el usuario cambió desde el perfil) y solo
// lo promueve a admin si venía con otro rol.
//
// Sin ETL_ADMIN_EMAIL la etapa queda omitida.
package admin

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/config"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/passwd"
)

// Identidad de la persona administradora que siembra el ETL. persona.nombre
// y persona.primer_apellido son NOT NULL, así que no pueden quedar vacíos.
// Coincide con la persona que ya existe en la base para que una recarga no
// duplique identidades.
const (
	nombre          = "Nicolas"
	primerApellido  = "Tocoyucra"
	segundoApellido = ""
)

// NombreCompleto se usa en los correos de credenciales.
var NombreCompleto = strings.TrimSpace(nombre + " " + primerApellido + " " + segundoApellido)

// Resultado describe lo que pasó con la cuenta admin en esta corrida.
type Resultado struct {
	Email     string
	Estado    string // creado | existia | promovido | omitido
	Detalle   string
	PersonaID int
	// Password solo tiene valor cuando la cuenta se creó en esta corrida:
	// es la que se manda por correo.
	Password string
}

func (r Resultado) String() string {
	if r.Estado == "" {
		return "sin registrar"
	}
	s := fmt.Sprintf("%s | %s", r.Estado, r.Email)
	if r.Detalle != "" {
		s += " | " + r.Detalle
	}
	return s
}

// Asegurar crea (o promueve) la cuenta administradora configurada en
// ETL_ADMIN_EMAIL. Devuelve error solo si falla la base: un correo que no se
// pueda mandar lo resuelve el pipeline aparte.
func Asegurar(ctx context.Context, pool *pgxpool.Pool, cfg config.Config) (Resultado, error) {
	res := Resultado{Email: cfg.AdminEmail}
	if res.Email == "" {
		res.Estado = "omitido"
		res.Detalle = "ETL_ADMIN_EMAIL vacío"
		return res, nil
	}

	var id, role string
	err := pool.QueryRow(ctx,
		`SELECT id, role FROM users WHERE lower(email) = lower($1)`, res.Email,
	).Scan(&id, &role)
	switch {
	case err == nil:
		if role == "admin" {
			res.Estado = "existia"
			res.Detalle = "ya era admin; no se toca su contraseña"
			return res, nil
		}
		// Existe como visitador (u otro rol): subirlo a admin es justamente
		// lo que se pide, y no cambia ni la contraseña ni la persona.
		if _, err := pool.Exec(ctx,
			`UPDATE users SET role = 'admin', updated_at = NOW() WHERE id = $1`, id,
		); err != nil {
			return res, fmt.Errorf("promoviendo a admin: %w", err)
		}
		res.Estado = "promovido"
		res.Detalle = fmt.Sprintf("rol %s -> admin", role)
		return res, nil
	case errors.Is(err, pgx.ErrNoRows):
		// Sigue abajo: hay que crearla.
	default:
		return res, fmt.Errorf("buscando usuario admin: %w", err)
	}

	password, err := passwd.Random()
	if err != nil {
		return res, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return res, fmt.Errorf("hasheando contraseña: %w", err)
	}

	personaID, err := crear(ctx, pool, res.Email, string(hash))
	if err != nil {
		return res, err
	}

	res.Estado = "creado"
	res.PersonaID = personaID
	res.Password = password
	res.Detalle = fmt.Sprintf("persona_id=%d rol=admin", personaID)
	return res, nil
}

// crear inserta persona + users en una transacción y devuelve el persona_id.
func crear(ctx context.Context, pool *pgxpool.Pool, email, hash string) (int, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("iniciando transacción: %w", err)
	}
	defer tx.Rollback(ctx)

	// Si la persona ya existe (la crearon desde la app) pero no tiene
	// usuario, se le agrega el login en vez de duplicar la identidad.
	personaID, ok, err := personaSinUsuario(ctx, tx, email)
	if err != nil {
		return 0, err
	}
	if !ok {
		err = tx.QueryRow(ctx,
			`INSERT INTO persona (nombre, primer_apellido, segundo_apellido, correo, status)
			 VALUES ($1, $2, NULLIF($3, ''), $4, true) RETURNING id`,
			nombre, primerApellido, segundoApellido, email,
		).Scan(&personaID)
		if err != nil {
			return 0, fmt.Errorf("insertando persona admin: %w", err)
		}
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO users (persona_id, email, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
		personaID, email, hash,
	); err != nil {
		return 0, fmt.Errorf("insertando usuario admin: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("confirmando usuario admin: %w", err)
	}
	return personaID, nil
}

// personaSinUsuario busca una persona con ese correo que todavía no esté
// asociada a un usuario.
func personaSinUsuario(ctx context.Context, tx pgx.Tx, email string) (int, bool, error) {
	var id int
	err := tx.QueryRow(ctx,
		`SELECT p.id FROM persona p
		 WHERE lower(p.correo) = lower($1)
		   AND NOT EXISTS (SELECT 1 FROM users u WHERE u.persona_id = p.id)
		 LIMIT 1`, email,
	).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, fmt.Errorf("buscando persona admin: %w", err)
	}
	return id, true, nil
}

// GuardarLog escribe las credenciales de la cuenta admin recién creada en
// logs/admin_<fecha>.log. Es el respaldo por si el correo no llega: la
// contraseña en claro solo existe en este archivo y en el mensaje enviado
// (en la base queda el hash). Devuelve "" cuando no hay nada que guardar.
func GuardarLog(res Resultado, logDir string) (string, error) {
	if res.Estado != "creado" || res.Password == "" {
		return "", nil
	}
	if err := os.MkdirAll(logDir, 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(logDir, fmt.Sprintf("admin_%s.log", time.Now().Format("20060102_150405")))

	f, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	w := func(format string, a ...any) { fmt.Fprintf(f, format+"\n", a...) }
	w("================== CUENTA ADMIN CREADA ==================")
	w("Fecha:    %s", time.Now().Format("2006-01-02 15:04:05"))
	w("Email:    %s", res.Email)
	w("Password: %s", res.Password)
	w("Detalle:  %s", res.Detalle)
	w("=========================================================")
	return path, nil
}
