package visitador

import (
	"encoding/csv"
	"fmt"
	"os"
	"strings"
)

// Extract abre un archivo CSV con la estructura pre-procesada de visitadores
// y devuelve los registros normalizados.
// Columnas esperadas: nombre,primer_apellido,segundo_apellido,ci,depto,telefono,nacimiento,correo
func Extract(path string) ([]Visitador, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("abriendo %s: %w", path, err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.LazyQuotes = true
	r.TrimLeadingSpace = true

	rows, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("leyendo CSV: %w", err)
	}
	if len(rows) < 2 {
		return nil, fmt.Errorf("el archivo %s no tiene filas de datos", path)
	}

	// Mapear encabezados a índices
	header := rows[0]
	idx := make(map[string]int, len(header))
	for i, h := range header {
		idx[strings.TrimSpace(strings.ToLower(h))] = i
	}
	field := func(name string) int {
		if i, ok := idx[name]; ok {
			return i
		}
		return -1
	}

	iNombre := field("nombre")
	iPri := field("primer_apellido")
	iSeg := field("segundo_apellido")
	iCi := field("ci")
	iDepto := field("depto")
	iTel := field("telefono")
	iNac := field("nacimiento")
	iCorr := field("correo")

	if iNombre < 0 || iCorr < 0 {
		return nil, fmt.Errorf("el CSV no tiene las columnas requeridas (nombre, correo)")
	}

	cell := func(row []string, i int) string {
		if i < 0 || i >= len(row) {
			return ""
		}
		return strings.TrimSpace(row[i])
	}

	var out []Visitador
	for i, row := range rows[1:] {
		nombre := cell(row, iNombre)
		if nombre == "" {
			continue
		}

		correo := cell(row, iCorr)
		if correo == "" {
			continue
		}

		nacimiento := cell(row, iNac)
		var nac *string
		if nacimiento != "" {
			nac = &nacimiento
		}

		vis := Visitador{
			Nombre:          nombre,
			PrimerApellido:  cell(row, iPri),
			SegundoApellido: cell(row, iSeg),
			Correo:          correo,
			Telefono:        cell(row, iTel),
			CI:              cell(row, iCi),
			DeptoCodigo:     cell(row, iDepto),
			Nacimiento:      nac,
		}
		_ = i
		out = append(out, vis)
	}
	return out, nil
}
