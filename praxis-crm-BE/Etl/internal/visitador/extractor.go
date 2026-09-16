package visitador

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

// excelEpoch es la fecha base del sistema de fechas de Excel.
var excelEpoch = time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)

// filaFuente es una fila cruda tal como viene del archivo.
type filaFuente struct {
	nombreCompleto string
	ci             string
	telefono       string
	incorporacion  string
	nacimiento     string
	correo         string
}

// Extract abre el archivo XLSX y devuelve las filas con datos de visitadores.
func Extract(path string) ([]Visitador, error) {
	f, err := excelize.OpenFile(path, excelize.Options{RawCellValue: true})
	if err != nil {
		return nil, fmt.Errorf("abriendo %s: %w", path, err)
	}
	defer f.Close()

	rows, err := f.GetRows(f.GetSheetName(0))
	if err != nil {
		return nil, fmt.Errorf("leyendo hojas: %w", err)
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("el archivo %s no tiene filas", path)
	}

	var out []Visitador
	for i, r := range rows {
		if i == 0 {
			continue // encabezado
		}
		raw := filaFuente{
			nombreCompleto: cell(r, 0),
			ci:             cell(r, 1),
			telefono:       cell(r, 2),
			incorporacion:  cell(r, 3),
			nacimiento:     cell(r, 4),
			correo:         cell(r, 5),
		}
		if raw.nombreCompleto == "" || strings.HasPrefix(strings.ToUpper(raw.nombreCompleto), "NOTA:") {
			continue
		}
		vis, err := normalizar(raw)
		if err != nil {
			return nil, fmt.Errorf("fila %d: %w", i+1, err)
		}
		out = append(out, vis)
	}
	return out, nil
}

func cell(row []string, idx int) string {
	if idx >= len(row) {
		return ""
	}
	return row[idx]
}

func normalizar(raw filaFuente) (Visitador, error) {
	nombreCompleto, err := nombreReal(raw.nombreCompleto)
	if err != nil {
		return Visitador{}, err
	}
	nombre, primerApellido, segundoApellido := dividirNombre(nombreCompleto)

	ci, deptoCodigo := dividirCI(raw.ci)

	nacimiento, err := parseFecha(raw.nacimiento)
	if err != nil {
		return Visitador{}, err
	}

	return Visitador{
		Nombre:          nombre,
		PrimerApellido:  primerApellido,
		SegundoApellido: segundoApellido,
		Correo:          strings.TrimSpace(raw.correo),
		Telefono:        strings.TrimSpace(raw.telefono),
		CI:              ci,
		DeptoCodigo:     deptoCodigo,
		Nacimiento:      nacimiento,
	}, nil
}

// nombreReal extrae el nombre real entre paréntesis cuando existe
// (p. ej. "Octavia (Celcina Cruz Menacho)" -> "Celcina Cruz Menacho").
func nombreReal(s string) (string, error) {
	s = strings.TrimSpace(s)
	if i := strings.Index(s, "("); i >= 0 {
		if j := strings.Index(s[i:], ")"); j > 0 {
			inner := strings.TrimSpace(s[i+1 : i+j])
			if inner != "" {
				return inner, nil
			}
		}
	}
	if s == "" {
		return "", fmt.Errorf("nombre de visitador vacío")
	}
	return s, nil
}

// dividirNombre separa el nombre completo en nombre, primer apellido y
// segundo apellido: los dos últimos términos son los apellidos y el resto
// el nombre. P. ej. "a b c d" -> nombre "a b", 1er apellido "c", 2do "d";
// "x y z" -> nombre "x", 1er apellido "y", 2do apellido "z".
func dividirNombre(full string) (nombre, primerApellido, segundoApellido string) {
	parts := strings.Fields(full)
	switch len(parts) {
	case 0:
		return "", "", ""
	case 1:
		return parts[0], "", ""
	case 2:
		return parts[0], parts[1], ""
	default:
		return strings.Join(parts[:len(parts)-2], " "), parts[len(parts)-2], parts[len(parts)-1]
	}
}

// dividirCI separa el número de carnet de la extensión (SC, LP, CBBA...).
func dividirCI(raw string) (ci, extension string) {
	fields := strings.Fields(strings.TrimSpace(raw))
	if len(fields) == 0 {
		return "", ""
	}
	ci = fields[0]
	if len(fields) > 1 {
		ext := strings.ToUpper(fields[len(fields)-1])
		if soloLetras(ext) {
			return ci, ext
		}
	}
	return ci, ""
}

func soloLetras(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if (r < 'A' || r > 'Z') && (r < 'a' || r > 'z') && r != 'Ñ' && r != 'ñ' {
			return false
		}
	}
	return true
}

// parseFecha normaliza una fecha a formato YYYY-MM-DD. Soporta fechas de
// Excel (número serial) y texto en formato DD/MM/YYYY.
func parseFecha(raw string) (*string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	if n, err := strconv.ParseFloat(raw, 64); err == nil {
		t := excelEpoch.Add(time.Duration(n * float64(24*time.Hour)))
		s := t.Format("2006-01-02")
		return &s, nil
	}
	for _, layout := range []string{"02/01/2006", "2006-01-02", "01/02/2006"} {
		if t, err := time.Parse(layout, raw); err == nil {
			s := t.Format("2006-01-02")
			return &s, nil
		}
	}
	return nil, fmt.Errorf("fecha no reconocida: %q", raw)
}
