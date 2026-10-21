// Package catalog carga los catálogos maestro del ETL (ciudad y especialidad)
// desde sus CSV y resuelve los valores crudos de los archivos de carteras
// hacia un id de la base de datos.
//
// Los catálogos son la única fuente de verdad: el ETL nunca inventa una
// ciudad ni una especialidad. Un valor crudo que no esté en el catálogo se
// reporta como error en vez de caerse a un valor por defecto silencioso,
// porque una especialidad mal atribuida se descubre meses después.
package catalog

import (
	"encoding/csv"
	"fmt"
	"os"
	"strings"
	"unicode"
)

// Normalize deja una clave comparable: sin acentos, en mayúsculas, sin
// puntos sobrantes y con espacios colapsados. Es la función que permite que
// "La paz", "LA PAZ" y "La Paz" resuelvan a la misma ciudad.
func Normalize(v string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return ""
	}

	var sb strings.Builder
	sb.Grow(len(v))
	prevSpace := false
	for _, r := range strings.ToUpper(v) {
		switch {
		case unicode.Is(unicode.Mn, r):
			// marca de acentuación: se descarta (LA PAZ == LA PAZ)
		case r == ' ' || r == '\t' || r == '\r' || r == '\n' || r == '.':
			if !prevSpace {
				sb.WriteByte(' ')
				prevSpace = true
			}
		default:
			sb.WriteRune(r)
			prevSpace = false
		}
	}
	return strings.TrimSpace(sb.String())
}

// readCSV lee un CSV separando por ';', que es el separador que usan los
// archivos generados por rebuild_medicos.py. Devuelve las filas como
// diccionario encabezado -> valor.
func readCSV(path string) ([]map[string]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("abriendo %s: %w", path, err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.Comma = ';'
	r.LazyQuotes = true
	r.TrimLeadingSpace = true
	r.FieldsPerRecord = -1

	rows, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("leyendo %s: %w", path, err)
	}
	if len(rows) < 2 {
		return nil, fmt.Errorf("%s no tiene filas de datos", path)
	}

	header := make([]string, len(rows[0]))
	for i, h := range rows[0] {
		header[i] = strings.ToLower(strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(h), "\ufeff")))
	}

	out := make([]map[string]string, 0, len(rows)-1)
	for _, row := range rows[1:] {
		rec := make(map[string]string, len(header))
		for i, name := range header {
			if i < len(row) {
				rec[name] = strings.TrimSpace(row[i])
			}
		}
		out = append(out, rec)
	}
	return out, nil
}

// splitSinonimos parte la columna sinonimos, separada por "$".
func splitSinonimos(v string) []string {
	var out []string
	for _, part := range strings.Split(v, "$") {
		if part = strings.TrimSpace(part); part != "" {
			out = append(out, part)
		}
	}
	return out
}
