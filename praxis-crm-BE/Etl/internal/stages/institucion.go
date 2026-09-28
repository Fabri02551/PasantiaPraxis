package stages

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/catalog"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/visitador"
)

// EtapaInstitucion carga src/instituciones/instituciones_carteras.csv.
//
// Va después de visitador por la misma razón que médico: la columna
// "VISITADOR ASIGNADO" se resuelve contra los visitadores ya cargados, e
// institucion.visitador_id los referencia.
//
// La columna ESPECIALIDAD de estos registros se ignora a propósito: las
// instituciones del CSV son en su mayoría laboratorios y clínicas, y la
// tabla institucion no tiene especialidad. Los valores dudosos que el
// clasificador marcó están en revisar_clasificacion.csv, que se carga a
// mano.
func EtapaInstitucion(
	ctx context.Context,
	pool *pgxpool.Pool,
	path string,
	ciudades *catalog.Ciudades,
	mapa *visitador.Mapa,
) (Resumen, error) {
	registros, err := leerCartera(path)
	if err != nil {
		return Resumen{}, err
	}
	log.Printf("[institucion] cartera con %d filas", len(registros))

	var ciudadesRaw, visitadoresRaw []string
	for _, rec := range registros {
		ciudadesRaw = append(ciudadesRaw, rec.columna("ciudad"))
		visitadoresRaw = append(visitadoresRaw, rec.columna("visitador asignado"))
	}
	if err := revisarAliasDevuelve("institucion", "CIUDAD", ciudades.SinAlias(ciudadesRaw)); err != nil {
		return Resumen{}, err
	}
	if err := revisarAliasDevuelve("institucion", "VISITADOR ASIGNADO", mapa.SinAlias(visitadoresRaw)); err != nil {
		return Resumen{}, err
	}

	existentes, err := indiceInstituciones(ctx, pool)
	if err != nil {
		return Resumen{}, err
	}
	log.Printf("[institucion] %d instituciones ya en la base", len(existentes))

	resumen := Resumen{Etapa: "institucion"}
	for _, rec := range registros {
		nombre := rec.columna("nombre completo")
		if nombre == "" {
			resumen.Omitidos++
			resumen.Detalle = append(resumen.Detalle, "fila sin NOMBRE COMPLETO")
			continue
		}

		var visitadorID *int
		if id, ok := mapa.Resolver(rec.columna("visitador asignado")); ok {
			visitadorID = &id
		}

		ciudadID := idCiudad(rec, ciudades, mapa, visitadorID)
		clave := catalog.Normalize(nombre)

		if id, ok := existentes[clave]; ok {
			if err := actualizarInstitucion(ctx, pool, rec, id, visitadorID, ciudadID); err != nil {
				resumen.Errores++
				resumen.Detalle = append(resumen.Detalle, fmt.Sprintf("%s: %v", nombre, err))
				continue
			}
			resumen.Actualizados++
			continue
		}

		if err := crearInstitucion(ctx, pool, rec, visitadorID, ciudadID); err != nil {
			resumen.Errores++
			resumen.Detalle = append(resumen.Detalle, fmt.Sprintf("%s: %v", nombre, err))
			continue
		}
		resumen.Insertados++
	}

	log.Printf("[institucion] %s", resumen)
	return resumen, nil
}

func indiceInstituciones(ctx context.Context, pool *pgxpool.Pool) (map[string]int, error) {
	rows, err := pool.Query(ctx, `SELECT id, nombre FROM institucion`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	indice := make(map[string]int)
	for rows.Next() {
		var id int
		var nombre string
		if err := rows.Scan(&id, &nombre); err != nil {
			return nil, err
		}
		indice[catalog.Normalize(nombre)] = id
	}
	return indice, rows.Err()
}

func crearInstitucion(
	ctx context.Context, pool *pgxpool.Pool, rec registroCartera,
	visitadorID, ciudadID *int,
) error {
	// es_particular va en true para todos, igual que en médico: la cartera
	// no distingue y con false ninguna institución se factorizaría.
	_, err := pool.Exec(ctx,
		`INSERT INTO institucion (nombre, direccion, telefono, visitador_id, ciudad_id, es_particular)
		 VALUES ($1, $2, NULLIF($3, ''), $4, $5, true)`,
		rec.columna("nombre completo"),
		jsonbTexto(rec.columna("direccion")),
		rec.columna("telefono"),
		visitadorID, ciudadID)
	if err != nil {
		return err
	}
	return nil
}

func actualizarInstitucion(
	ctx context.Context, pool *pgxpool.Pool, rec registroCartera,
	id int, visitadorID, ciudadID *int,
) error {
	// clasificacion NO se toca a propósito: el usuario la revisa y la sube
	// a mano desde revisar_clasificacion.csv.
	_, err := pool.Exec(ctx,
		`UPDATE institucion
		 SET direccion = $1,
		     telefono = COALESCE(NULLIF($2, ''), telefono),
		     visitador_id = COALESCE($3, visitador_id),
		     ciudad_id = COALESCE($4, ciudad_id),
		     es_particular = true,
		     status = true
		 WHERE id = $5`,
		jsonbTexto(rec.columna("direccion")),
		rec.columna("telefono"),
		visitadorID, ciudadID, id)
	return err
}
