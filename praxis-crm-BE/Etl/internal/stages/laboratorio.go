package stages

import (
	"context"
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/catalog"
)

// prefijoPrecio es el patrón de las columnas de precio del CSV de
// laboratorios: precio_base_cbba, precio_base_lpz, precio_base_scz...
const prefijoPrecio = "precio_base_"

// EtapaLaboratorio carga src/laboratorios/precios_base_por_departamento.csv
// en dos tablas:
//
//	laboratorio        -> un estudio con su precio base
//	laboratorio_ciudad -> el costo de ese estudio en cada departamento
//
// Es la última etapa porque laboratorio_ciudad.ciudad_id referencia
// ciudad: sin la etapa ciudad cargada no hay dónde colgar los precios.
func EtapaLaboratorio(
	ctx context.Context,
	pool *pgxpool.Pool,
	path string,
	ciudades *catalog.Ciudades,
) (Resumen, error) {
	filas, columnasPrecio, err := leerLaboratorios(path)
	if err != nil {
		return Resumen{}, err
	}
	log.Printf("[laboratorio] %d estudios y %d columnas de precio", len(filas), len(columnasPrecio))

	// Cada columna de precio se traduce a una ciudad del catálogo por el
	// código corto: precio_base_cbba -> Cochabamba. Se valida antes de
	// insertar nada para no cargar la mitad de la tabla y fallar después.
	for _, col := range columnasPrecio {
		codigo := strings.TrimPrefix(col, prefijoPrecio)
		if _, ok := ciudades.IDByAlias(codigo); !ok {
			return Resumen{}, fmt.Errorf(
				"[laboratorio] la columna %q no corresponde a ninguna ciudad del catálogo (código %q). "+
					"Agrega el código a la columna 'sinonimos' de src/ciudad/ciudades.csv", col, codigo)
		}
	}
	log.Printf("[laboratorio] precios por: %v", columnasPrecio)

	existentes, err := indiceLaboratorios(ctx, pool)
	if err != nil {
		return Resumen{}, err
	}
	log.Printf("[laboratorio] %d estudios ya en la base", len(existentes))

	resumen := Resumen{Etapa: "laboratorio"}
	for _, fila := range filas {
		estudio := strings.TrimSpace(fila["estudio"])
		if estudio == "" {
			resumen.Omitidos++
			continue
		}

		area := strings.TrimSpace(fila["area"])
		if area == "" {
			// laboratorio.area es NOT NULL: se rellena con un valor por
			// defecto para que el estudio no quede fuera del filtro.
			area = valorPorDefectoArea
		}
		// La comisión del CSV es una fracción (0.25 = 25%).
		comision, _ := strconv.ParseFloat(strings.ReplaceAll(strings.TrimSpace(fila["descuento"]), ",", "."), 64)
		// laboratorio.precio toma la primera columna del archivo, que es el
		// precio base de referencia; el detalle por departamento queda en
		// laboratorio_ciudad.
		precio, _ := strconv.ParseFloat(strings.ReplaceAll(strings.TrimSpace(fila[columnasPrecio[0]]), ",", "."), 64)

		clave := catalog.Normalize(estudio)
		if id, ok := existentes[clave]; ok {
			if err := actualizarLaboratorio(ctx, pool, id, area, comision, precio); err != nil {
				resumen.Errores++
				resumen.Detalle = append(resumen.Detalle, fmt.Sprintf("%s: %v", estudio, err))
				continue
			}
			if err := cargarPrecios(ctx, pool, id, fila, columnasPrecio, ciudades); err != nil {
				resumen.Errores++
				resumen.Detalle = append(resumen.Detalle, fmt.Sprintf("%s (precios): %v", estudio, err))
				continue
			}
			resumen.Actualizados++
			continue
		}

		id, err := crearLaboratorio(ctx, pool, estudio, area, comision, precio)
		if err != nil {
			resumen.Errores++
			resumen.Detalle = append(resumen.Detalle, fmt.Sprintf("%s: %v", estudio, err))
			continue
		}
		if err := cargarPrecios(ctx, pool, id, fila, columnasPrecio, ciudades); err != nil {
			resumen.Errores++
			resumen.Detalle = append(resumen.Detalle, fmt.Sprintf("%s (precios): %v", estudio, err))
			continue
		}
		existentes[clave] = id
		resumen.Insertados++
	}

	log.Printf("[laboratorio] %s", resumen)
	return resumen, nil
}

const valorPorDefectoArea = "SIN AREA"

func leerLaboratorios(path string) ([]map[string]string, []string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, fmt.Errorf("abriendo %s: %w", path, err)
	}
	defer f.Close()

	// El archivo está separado por comas y viene con relleno de espacios
	// alrededor de cada campo, por eso TrimLeadingSpace y el TrimSpace de
	// cada valor al armar el mapa.
	r := csv.NewReader(f)
	r.Comma = ','
	r.FieldsPerRecord = -1
	r.TrimLeadingSpace = true

	filas, err := r.ReadAll()
	if err != nil {
		return nil, nil, fmt.Errorf("leyendo %s: %w", path, err)
	}
	if len(filas) < 2 {
		return nil, nil, fmt.Errorf("%s no tiene filas de datos", path)
	}

	header := filas[0]
	var precios []string
	for _, col := range header {
		col = strings.TrimSpace(col)
		if strings.HasPrefix(strings.ToLower(col), prefijoPrecio) {
			precios = append(precios, col)
		}
	}
	if len(precios) == 0 {
		return nil, nil, fmt.Errorf("%s no tiene columnas %s*; revisa el formato del archivo", path, prefijoPrecio)
	}

	out := make([]map[string]string, 0, len(filas)-1)
	for _, fila := range filas[1:] {
		rec := make(map[string]string, len(header))
		for i, col := range header {
			if i < len(fila) {
				rec[strings.TrimSpace(col)] = strings.TrimSpace(fila[i])
			}
		}
		if strings.TrimSpace(rec["estudio"]) == "" {
			continue
		}
		out = append(out, rec)
	}
	return out, precios, nil
}

func indiceLaboratorios(ctx context.Context, pool *pgxpool.Pool) (map[string]int, error) {
	rows, err := pool.Query(ctx, `SELECT id, nombre FROM laboratorio`)
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

func crearLaboratorio(ctx context.Context, pool *pgxpool.Pool, nombre, area string, comision, precio float64) (int, error) {
	var id int
	err := pool.QueryRow(ctx,
		`INSERT INTO laboratorio (nombre, area, precio, comision_extra)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		nombre, area, precio, comision).Scan(&id)
	if err != nil {
		return 0, err
	}
	return id, nil
}

func actualizarLaboratorio(ctx context.Context, pool *pgxpool.Pool, id int, area string, comision, precio float64) error {
	_, err := pool.Exec(ctx,
		`UPDATE laboratorio SET area = $1, precio = $2, comision_extra = $3, status = true WHERE id = $4`,
		area, precio, comision, id)
	return err
}

// cargarPrecios llena laboratorio_ciudad. El costo va en 0 cuando el
// departamento no ofrece el estudio, que es lo que el esquema documenta
// como "no disponible en esa ciudad".
func cargarPrecios(
	ctx context.Context,
	pool *pgxpool.Pool,
	laboratorioID int,
	fila map[string]string,
	columnas []string,
	ciudades *catalog.Ciudades,
) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, col := range columnas {
		ciudadID, ok := ciudades.IDByAlias(strings.TrimPrefix(col, prefijoPrecio))
		if !ok {
			return fmt.Errorf("la columna %q no resuelve a una ciudad", col)
		}
		costo, _ := strconv.ParseFloat(strings.ReplaceAll(strings.TrimSpace(fila[col]), ",", "."), 64)

		if _, err := tx.Exec(ctx,
			`INSERT INTO laboratorio_ciudad (laboratorio_id, ciudad_id, costo) VALUES ($1, $2, $3)
			 ON CONFLICT (laboratorio_id, ciudad_id) DO UPDATE SET costo = EXCLUDED.costo`,
			laboratorioID, ciudadID, costo); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
