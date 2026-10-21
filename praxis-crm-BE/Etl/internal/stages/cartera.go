package stages

import (
	"encoding/csv"
	"fmt"
	"os"
	"strings"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/catalog"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/visitador"
)

// registroCartera es una fila de los CSV que produce rebuild_medicos.py.
// Los tres archivos (médicos, instituciones y revise) comparten casi todas
// las columnas, así que se leen con un solo tipo.
type registroCartera map[string]string

func leerCartera(path string) ([]registroCartera, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("abriendo %s: %w", path, err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.Comma = ';'
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

	out := make([]registroCartera, 0, len(rows)-1)
	for _, row := range rows[1:] {
		rec := make(registroCartera, len(header))
		for i, name := range header {
			if i < len(row) {
				rec[name] = strings.TrimSpace(row[i])
			}
		}
		out = append(out, rec)
	}
	return out, nil
}

// columna devuelve el valor de una columna del CSV.
func (r registroCartera) columna(nombre string) string {
	return strings.TrimSpace(r[nombre])
}

// partidoDivide "NOMBRE COMPLETO" en nombre y apellidos para llenar
// persona.nombre, persona.primer_apellido y persona.segundo_apellido, que
// el CSV no trae separados.
//
// Los títulos (DR, DRA, LIC) se descartan porque el CSV de carteras los
// incluye en el nombre y no son parte de la identidad de la persona.
var titulos = map[string]bool{"DR": true, "DRA": true, "LIC": true, "DRS": true, "DRAS": true}

func partidoDivide(nombreCompleto string) (nombre, primer, segundo string) {
	tokens := strings.Fields(nombreCompleto)
	limpios := make([]string, 0, len(tokens))
	for _, t := range tokens {
		t = strings.Trim(t, ".,;:()[]")
		if t == "" || titulos[strings.ToUpper(strings.Trim(t, "."))] {
			continue
		}
		limpios = append(limpios, t)
	}

	switch len(limpios) {
	case 0:
		// No hay nada que poner: persona.nombre y primer_apellido son NOT
		// NULL, así que se rellenan con un valor por defecto.
		return valorPorDefectoNombre, valorPorDefectoApellido, ""
	case 1:
		// "VILLAMED" o "AGFA": un solo token no alcanza para nombre y
		// apellido, y es preferible marcarlo como faltante a inventar uno.
		return limpios[0], valorPorDefectoApellido, ""
	default:
		nombre = limpios[0]
		primer = limpios[1]
		segundo = strings.Join(limpios[2:], " ")
	}
	return nombre, primer, segundo
}

const (
	valorPorDefectoNombre   = "SIN NOMBRE"
	valorPorDefectoApellido = "SIN APELLIDO"
	valorPorDefectoSexo     = "NO ESPECIFICADO"
)

// idCiudad devuelve la ciudad de un registro: primero intenta la columna
// CIUDAD y, si está vacía o el catálogo no la reconoce, cae a la ciudad del
// visitador asignado. Los médicos de una kartera siempre pertenecen a
// alguna ciudad, así que rara vez queda NULL.
func idCiudad(rec registroCartera, ciudades *catalog.Ciudades, mapa *visitador.Mapa, visitadorID *int) *int {
	if id, ok := ciudades.IDByAlias(rec.columna("ciudad")); ok {
		return &id
	}
	if visitadorID != nil {
		if id, ok := mapa.CiudadDe(*visitadorID); ok {
			return &id
		}
	}
	return nil
}

// revisarAliasDevuelve error si algún valor crudo de la cartera no está en
// el catálogo. Cortar la corrida es preferible a cargar mil filas con la
// especialidad inventada.
func revisarAliasDevuelve(etapa, columna string, valores []string) error {
	if len(valores) == 0 {
		return nil
	}
	return fmt.Errorf("[%s] %d valores de la columna %s no están en el catálogo y no se pueden resolver: %s",
		etapa, len(valores), columna, strings.Join(valores, ", "))
}
