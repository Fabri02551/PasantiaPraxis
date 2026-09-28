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

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/catalog"
)

type Loader struct {
	pool *pgxpool.Pool
}

func NewLoader(pool *pgxpool.Pool) *Loader {
	return &Loader{pool: pool}
}

// Load inserta o actualiza cada visitador y devuelve, además del detalle por
// registro, un mapa alias -> persona_id que usan las etapas de médico e
// institución para resolver la columna "VISITADOR ASIGNADO".
//
// La carga es idempotente: el visitador se reconoce por CI y, si no lo
// tiene, por correo. Reejecutar el ETL actualiza los datos en vez de
// duplicarlos, y nunca borra visitadores que ya tengan médicos asignados
// (medico.visitador_id).
func (l *Loader) Load(ctx context.Context, visitadores []Visitador, ciudades *catalog.Ciudades) (*Mapa, []Result, error) {
	mapa := NewMapa()
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

		ciudadID, nombreCiudad := resolverCiudad(ciudades, v.DeptoCodigo)
		v.CiudadID = ciudadID
		if nombreCiudad == "" {
			// Sin departamento reconocible la persona queda con ciudad_id
			// NULL, que es NULL en el esquema y no rompe nada.
			nombreCiudad = "sin departamento"
		}
		res.Ciudad = nombreCiudad

		personaID, existente, err := l.buscar(ctx, v)
		if err != nil {
			res.Estado = "error"
			res.Detalle = err.Error()
			results = append(results, res)
			continue
		}

		if existente {
			if err := l.actualizar(ctx, personaID, v); err != nil {
				res.Estado = "error"
				res.Detalle = err.Error()
				results = append(results, res)
				continue
			}
			mapa.Agregar(v, personaID)
			res.Estado = "actualizado"
			res.Detalle = fmt.Sprintf("persona_id=%d", personaID)
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

		personaID, err = l.insertar(ctx, v, password)
		if err != nil {
			res.Estado = "error"
			res.Detalle = err.Error()
			results = append(results, res)
			continue
		}

		mapa.Agregar(v, personaID)
		res.Password = password
		res.Estado = "insertado"
		res.Detalle = fmt.Sprintf("persona_id=%d", personaID)
		results = append(results, res)
	}

	return mapa, results, nil
}

// buscar localiza un visitador ya cargado. El CI es la clave natural más
// estable; el correo es el respaldo para los que no lo tienen.
func (l *Loader) buscar(ctx context.Context, v Visitador) (int, bool, error) {
	if v.CI != "" {
		var id int
		err := l.pool.QueryRow(ctx,
			`SELECT p.id FROM persona p
			 JOIN visitador vt ON vt.persona_id = p.id
			 WHERE p.ci = $1 LIMIT 1`, v.CI).Scan(&id)
		if err == nil {
			return id, true, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return 0, false, fmt.Errorf("buscando visitador por CI: %w", err)
		}
	}

	var id int
	err := l.pool.QueryRow(ctx,
		`SELECT p.id FROM persona p
		 JOIN users u ON u.persona_id = p.id
		 WHERE lower(u.email) = lower($1) LIMIT 1`, v.Correo).Scan(&id)
	if err == nil {
		return id, true, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}
	return 0, false, fmt.Errorf("buscando visitador por correo: %w", err)
}

func (l *Loader) actualizar(ctx context.Context, personaID int, v Visitador) error {
	tag, err := l.pool.Exec(ctx,
		`UPDATE persona
		 SET nombre = $1, primer_apellido = $2, segundo_apellido = $3, sexo = $4,
		     correo = $5, telefono = NULLIF($6, ''), nacimiento = $7, ciudad_id = $8
		 WHERE id = $9`,
		v.Nombre, v.PrimerApellido, v.SegundoApellido, v.Sexo, v.Correo, v.Telefono, v.Nacimiento, v.CiudadID, personaID,
	)
	if err != nil {
		return fmt.Errorf("actualizando persona %d: %w", personaID, err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("la persona %d no existe", personaID)
	}

	// El correo es UNIQUE en users: puede haber cambiado de.visitador por
	// una carga anterior con otra dirección.
	if _, err := l.pool.Exec(ctx, `UPDATE users SET email = $1 WHERE persona_id = $2`, v.Correo, personaID); err != nil {
		return fmt.Errorf("actualizando correo del visitador %d: %w", personaID, err)
	}
	if _, err := l.pool.Exec(ctx,
		`UPDATE visitador
		 SET activo = true, status = true,
		     latitud = COALESCE($2, latitud), longitud = COALESCE($3, longitud)
		 WHERE persona_id = $1`, personaID, v.Latitud, v.Longitud); err != nil {
		return fmt.Errorf("activando visitador %d: %w", personaID, err)
	}
	return nil
}

func (l *Loader) insertar(ctx context.Context, v Visitador, password string) (int, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return 0, fmt.Errorf("hasheando contraseña: %w", err)
	}

	tx, err := l.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("iniciando transacción: %w", err)
	}
	defer tx.Rollback(ctx)

	// persona.nombre y persona.primer_apellido son NOT NULL: el CSV puede
	// traerlos vacíos y se rellenan con un valor por defecto en vez de
	// abortar la carga.
	var personaID int
	err = tx.QueryRow(ctx,
		`INSERT INTO persona (nombre, primer_apellido, segundo_apellido, sexo, correo, telefono, ci, nacimiento, ciudad_id)
		 VALUES ($1, COALESCE(NULLIF($2, ''), 'SIN APELLIDO'), $3, $4, $5, NULLIF($6, ''), NULLIF($7, ''), $8, $9)
		 RETURNING id`,
		orDefault(v.Nombre, "SIN NOMBRE"), v.PrimerApellido, v.SegundoApellido, v.Sexo,
		v.Correo, v.Telefono, v.CI, v.Nacimiento, v.CiudadID,
	).Scan(&personaID)
	if err != nil {
		return 0, fmt.Errorf("insertando persona: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO visitador (persona_id, latitud, longitud) VALUES ($1, $2, $3)`,
		personaID, v.Latitud, v.Longitud,
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

func orDefault(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}

// resolverCiudad traduce el código de departamento del CSV a un id de
// ciudad. Primero prueba el catálogo, que ya trae los códigos como alias;
// si no aparece, cae a la tabla local por si el catálogo quedó viejo.
func resolverCiudad(ciudades *catalog.Ciudades, codigo string) (*int, string) {
	codigo = strings.TrimSpace(codigo)
	if codigo == "" {
		return nil, ""
	}

	if id, ok := ciudades.IDByAlias(codigo); ok {
		return &id, ciudades.NombrePorID(id)
	}
	if nombre := deptoNombre(codigo); nombre != "" {
		if id, ok := ciudades.IDByName(nombre); ok {
			return &id, ciudades.NombrePorID(id)
		}
	}
	return nil, ""
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
