package visitador

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Loader struct {
	pool *pgxpool.Pool
}

func NewLoader(pool *pgxpool.Pool) *Loader {
	return &Loader{pool: pool}
}

// SeedDepartamentos asegura que los 9 departamentos de Bolivia existan
// en la tabla ciudad. Devuelve el mapa nombre -> id.
func (l *Loader) SeedDepartamentos(ctx context.Context) (map[string]int, error) {
	ids := make(map[string]int, len(Departamentos))
	for _, nombre := range Departamentos {
		var id int
		err := l.pool.QueryRow(ctx,
			`SELECT id FROM ciudad WHERE nombre = $1 LIMIT 1`, nombre,
		).Scan(&id)
		if err == nil {
			ids[nombre] = id
			continue
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("buscando departamento %q: %w", nombre, err)
		}
		err = l.pool.QueryRow(ctx,
			`INSERT INTO ciudad (nombre) VALUES ($1) RETURNING id`, nombre,
		).Scan(&id)
		if err != nil {
			return nil, fmt.Errorf("insertando departamento %q: %w", nombre, err)
		}
		ids[nombre] = id
	}
	return ids, nil
}

// Load inserta cada visitador (persona + visitador + usuario) en su propia
// transacción y devuelve el resultado de cada uno.
func (l *Loader) Load(ctx context.Context, visitadores []Visitador, ciudadIDs map[string]int) ([]Result, error) {
	results := make([]Result, 0, len(visitadores))
	for _, v := range visitadores {
		res := Result{
			Nombre:          v.Nombre,
			PrimerApellido:  v.PrimerApellido,
			SegundoApellido: v.SegundoApellido,
			Email:           v.Correo,
			CI:              v.CI,
		}

		if v.Correo == "" {
			res.Estado = "omitido"
			res.Detalle = "sin correo electrónico"
			results = append(results, res)
			continue
		}

		depto := deptoNombre(v.DeptoCodigo)
		if depto == "" {
			depto = "Cochabamba"
		}
		if id, ok := ciudadIDs[depto]; ok {
			res.Ciudad = depto
			v.CiudadID = &id
		}

		existe, err := l.emailExiste(ctx, v.Correo)
		if err != nil {
			res.Estado = "error"
			res.Detalle = err.Error()
			results = append(results, res)
			continue
		}
		if existe {
			res.Estado = "omitido"
			res.Detalle = "el correo ya estaba registrado"
			results = append(results, res)
			continue
		}

		password, err := randomPassword()
		if err != nil {
			res.Estado = "error"
			res.Detalle = fmt.Sprintf("generando contraseña: %v", err)
			results = append(results, res)
			continue
		}

		personaID, err := l.insertVisitador(ctx, v, password)
		if err != nil {
			res.Estado = "error"
			res.Detalle = err.Error()
			results = append(results, res)
			continue
		}

		res.Password = password
		res.Estado = "insertado"
		res.Detalle = fmt.Sprintf("persona_id=%d", personaID)
		results = append(results, res)
	}
	return results, nil
}

func (l *Loader) emailExiste(ctx context.Context, email string) (bool, error) {
	var one int
	err := l.pool.QueryRow(ctx,
		`SELECT 1 FROM users WHERE email = $1 LIMIT 1`, email,
	).Scan(&one)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return false, fmt.Errorf("verificando email: %w", err)
}

func (l *Loader) insertVisitador(ctx context.Context, v Visitador, password string) (int, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return 0, fmt.Errorf("hasheando contraseña: %w", err)
	}

	tx, err := l.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("iniciando transacción: %w", err)
	}
	defer tx.Rollback(ctx)

	var personaID int
	err = tx.QueryRow(ctx,
		`INSERT INTO persona (nombre, primer_apellido, segundo_apellido, sexo, correo, telefono, ci, nacimiento, ciudad_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
		v.Nombre, v.PrimerApellido, v.SegundoApellido, v.Sexo, v.Correo, v.Telefono, v.CI, v.Nacimiento, v.CiudadID,
	).Scan(&personaID)
	if err != nil {
		return 0, fmt.Errorf("insertando persona: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO visitador (persona_id) VALUES ($1)`, personaID,
	); err != nil {
		return 0, fmt.Errorf("insertando visitador: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO users (persona_id, email, password_hash, role) VALUES ($1, $2, $3, 'visitador')`,
		personaID, v.Correo, string(hash),
	); err != nil {
		return 0, fmt.Errorf("insertando usuario: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("confirmando transacción: %w", err)
	}
	return personaID, nil
}

func deptoNombre(codigo string) string {
	if codigo == "" {
		return ""
	}
	return deptoPorExtension[strings.ToUpper(codigo)]
}

const passwordCharset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"

func randomPassword() (string, error) {
	max := big.NewInt(int64(len(passwordCharset)))
	var sb strings.Builder
	for i := 0; i < 12; i++ {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		sb.WriteByte(passwordCharset[n.Int64()])
	}
	return sb.String(), nil
}
