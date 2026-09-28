package stages

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/catalog"
)

// EtapaEspecialidad carga src/especialidad/especialidades.csv.
//
// Va justo después de ciudad y antes que médico: medico.especialidad_id es
// NOT NULL REFERENCES especialidad, así que ningún médico se puede insertar
// sin una especialidad previa.
func EtapaEspecialidad(ctx context.Context, pool *pgxpool.Pool, path string) (*catalog.Especialidades, Resumen, error) {
	cat, err := catalog.LoadEspecialidades(path)
	if err != nil {
		return nil, Resumen{}, err
	}
	log.Printf("[especialidad] catálogo con %d especialidades canónicas", len(cat.Orden))

	insertadas, reasignadas := 0, 0
	for i := range cat.Orden {
		esp := &cat.Orden[i]

		// Se busca primero por codigo, que ya es UNIQUE en el esquema, y
		// después por nombre normalizado: la base tenía "Cardiologia" con
		// código CARD, que es este mismo catálogo escrito a mano.
		var (
			id     int
			actual string
			err    error
		)
		err = pool.QueryRow(ctx, `SELECT id, nombre FROM especialidad WHERE codigo = $1`, esp.Codigo).Scan(&id, &actual)
		if err == pgx.ErrNoRows {
			err = pool.QueryRow(ctx,
				`SELECT id, nombre FROM especialidad
				 WHERE lower(btrim(nombre)) = lower(btrim($1)) LIMIT 1`, esp.Nombre).Scan(&id, &actual)
		}

		switch {
		case err == nil:
			// Se actualizan nombre y código para que el catálogo manda, pero
			// conservando el id: los médicos ya cargados apuntan a él.
			if !strings.EqualFold(strings.TrimSpace(actual), esp.Nombre) {
				if _, err := pool.Exec(ctx,
					`UPDATE especialidad SET nombre = $1, codigo = $2 WHERE id = $3`,
					esp.Nombre, esp.Codigo, id); err != nil {
					return nil, Resumen{}, fmt.Errorf("actualizando especialidad %q: %w", esp.Codigo, err)
				}
				reasignadas++
			}
		case errors.Is(err, pgx.ErrNoRows):
			if err := pool.QueryRow(ctx,
				`INSERT INTO especialidad (nombre, codigo) VALUES ($1, $2) RETURNING id`,
				esp.Nombre, esp.Codigo).Scan(&id); err != nil {
				return nil, Resumen{}, fmt.Errorf("insertando especialidad %q: %w", esp.Codigo, err)
			}
			insertadas++
		default:
			return nil, Resumen{}, fmt.Errorf("buscando especialidad %q: %w", esp.Codigo, err)
		}

		cat.Bind(i, id)
	}

	if _, err := pool.Exec(ctx,
		`CREATE UNIQUE INDEX IF NOT EXISTS ux_especialidad_nombre ON especialidad (lower(btrim(nombre)))`); err != nil {
		return nil, Resumen{}, fmt.Errorf("creando índice único de especialidad: %w", err)
	}

	log.Printf("[especialidad] %d insertadas, %d normalizadas", insertadas, reasignadas)
	return cat, Resumen{Etapa: "especialidad", Insertados: insertadas, Actualizados: reasignadas}, nil
}
