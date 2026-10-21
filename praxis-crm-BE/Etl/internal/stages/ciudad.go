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

// EtapaCiudad carga src/ciudad/ciudades.csv.
//
// Es la primera etapa porque persona.ciudad_id, institucion.ciudad_id y
// laboratorio_ciudad.ciudad_id la referencian: sin ciudades cargadas, el
// resto de las etapas no puede resolver sus claves foráneas.
func EtapaCiudad(ctx context.Context, pool *pgxpool.Pool, path string) (*catalog.Ciudades, Resumen, error) {
	cat, err := catalog.LoadCiudades(path)
	if err != nil {
		return nil, Resumen{}, err
	}
	log.Printf("[ciudad] catálogo con %d ciudades", len(cat.Orden))

	if err := unificarCiudad(ctx, pool); err != nil {
		return nil, Resumen{}, fmt.Errorf("unificando ciudades existentes: %w", err)
	}

	insertadas, actualizadas := 0, 0
	for i := range cat.Orden {
		ciudad := &cat.Orden[i]

		// Se busca por nombre normalizado porque la tabla no tenía índice
		// único y "Cochabamba" vs "cochabamba " cuentan como la misma.
		var id int
		var actual string
		err := pool.QueryRow(ctx,
			`SELECT id, nombre FROM ciudad WHERE lower(btrim(nombre)) = lower(btrim($1)) LIMIT 1`,
			ciudad.Nombre,
		).Scan(&id, &actual)
		switch {
		case err == nil:
			if !strings.EqualFold(strings.TrimSpace(actual), ciudad.Nombre) {
				if _, err := pool.Exec(ctx, `UPDATE ciudad SET nombre = $1 WHERE id = $2`, ciudad.Nombre, id); err != nil {
					return nil, Resumen{}, fmt.Errorf("normalizando nombre de ciudad %q: %w", actual, err)
				}
				actualizadas++
			}
		case errors.Is(err, pgx.ErrNoRows):
			if err := pool.QueryRow(ctx,
				`INSERT INTO ciudad (nombre) VALUES ($1) RETURNING id`,
				ciudad.Nombre,
			).Scan(&id); err != nil {
				return nil, Resumen{}, fmt.Errorf("insertando ciudad %q: %w", ciudad.Nombre, err)
			}
			insertadas++
		default:
			return nil, Resumen{}, fmt.Errorf("buscando ciudad %q: %w", ciudad.Nombre, err)
		}

		// Reemplaza el índice de posición por el id real de la base.
		cat.Bind(i, id)
	}

	log.Printf("[ciudad] %d insertadas, %d normalizadas", insertadas, actualizadas)
	return cat, Resumen{Etapa: "ciudad", Insertados: insertadas, Actualizados: actualizadas}, nil
}

// unificarCiudad deja la tabla ciudad sin duplicados por nombre y agrega el
// índice único que hace idempotente la etapa. La base podía venir con filas
// repetidas ("La Paz" y "la paz") de cargas manuales anteriores, así que
// antes de crear el índice hay que fusionarlas moviendo las referencias.
func unificarCiudad(ctx context.Context, pool *pgxpool.Pool) error {
	rows, err := pool.Query(ctx, `SELECT id, lower(btrim(nombre)) FROM ciudad ORDER BY id`)
	if err != nil {
		return err
	}
	// clave normalizada -> ids, en el orden en que aparecieron
	grupos := make(map[string][]int32)
	var orden []string
	for rows.Next() {
		var id int32
		var clave string
		if err := rows.Scan(&id, &clave); err != nil {
			rows.Close()
			return err
		}
		if _, existe := grupos[clave]; !existe {
			orden = append(orden, clave)
		}
		grupos[clave] = append(grupos[clave], id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, clave := range orden {
		ids := grupos[clave]
		if len(ids) < 2 {
			continue
		}
		// sobrevive el id más bajo: es el que ya referencia el resto
		keep, dupes := ids[0], ids[1:]
		for _, dup := range dupes {
			if _, err := pool.Exec(ctx, `UPDATE persona SET ciudad_id = $1 WHERE ciudad_id = $2`, keep, dup); err != nil {
				return err
			}
			if _, err := pool.Exec(ctx, `UPDATE institucion SET ciudad_id = $1 WHERE ciudad_id = $2`, keep, dup); err != nil {
				return err
			}
			// laboratorio_ciudad tiene PK compuesta (laboratorio_id, ciudad_id):
			// la fila repetida choca con la de la ciudad superviviente, así
			// que se borra antes de poder eliminar la ciudad por la FK.
			if _, err := pool.Exec(ctx,
				`DELETE FROM laboratorio_ciudad lc
				 WHERE lc.ciudad_id = $1
				   AND EXISTS (SELECT 1 FROM laboratorio_ciudad k
				               WHERE k.ciudad_id = $2 AND k.laboratorio_id = lc.laboratorio_id)`, dup, keep); err != nil {
				return err
			}
			if _, err := pool.Exec(ctx, `DELETE FROM laboratorio_ciudad WHERE ciudad_id = $1`, dup); err != nil {
				return err
			}
			if _, err := pool.Exec(ctx, `DELETE FROM ciudad WHERE id = $1`, dup); err != nil {
				return err
			}
			log.Printf("[ciudad] fusionada la ciudad duplicada %q (id %d) en la id %d", clave, dup, keep)
		}
	}

	_, err = pool.Exec(ctx,
		`CREATE UNIQUE INDEX IF NOT EXISTS ux_ciudad_nombre ON ciudad (lower(btrim(nombre)))`)
	return err
}
