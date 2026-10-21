package stages

import (
	"fmt"
	"path/filepath"
	"testing"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/catalog"
)

// TestClaveMedicoNoFusionaPersonasDistintas cubre el caso por el que la
// clave por nombre solo falló: la cartera tiene 10 nombres repetidos y al
// menos tres son personas distintas (DR. JOSE MARTIN DAZA, LIMBER ROCABADO
// SOSA y DRA. ANGELICA VERA CUELLAR). La clave debe separar todo lo que la
// cartera presenta como distinto y solo fusionar lo que es idéntico.
//
// La clave combina nombre + MEDICO ID, y con MEDICO ID vacío, nombre +
// especialidad + institución. Un mismo (nombre, MEDICO ID) es la única
// señal de que dos filas son la misma persona y, en la cartera, esas filas
// resultaron ser copias idénticas en todos los campos.
func TestClaveMedicoNoFusionaPersonasDistintas(t *testing.T) {
	registros, err := leerCartera(filepath.Join(srcRel, "medicos", "medicos_carteras.csv"))
	if err != nil {
		t.Fatal(err)
	}

	grupos := make(map[string][]registroCartera)
	for _, rec := range registros {
		nombre, primer, segundo := partidoDivide(rec.columna("nombre completo"))
		clave := claveMedico(nombre, primer, segundo,
			rec.columna("medico id"), rec.columna("especialidad"), rec.columna("institucion"))
		grupos[clave] = append(grupos[clave], rec)
	}

	// 1892 filas; 6 pares de personas distintas y 4 pares de copias
	// idénticas que sí deben colapsar: 1892 - 4 = 1888 claves distintas.
	if n := len(grupos); n != 1888 {
		t.Errorf("la cartera genera %d claves distintas, se esperaban 1888", n)
	}

	// Los grupos con más de una fila solo son aceptables si todos sus
	// miembros son iguales en los campos de identidad: de lo contrario hay
	// dos personas metidas en la misma clave y el ETL perdería gente.
	for clave, grupo := range grupos {
		if len(grupo) < 2 {
			continue
		}
		referencia := identidad(grupo[0])
		for i, fila := range grupo[1:] {
			if identidad(fila) != referencia {
				t.Errorf("clave %q agrupa filas distintas: %q vs %q",
					clave, identidad(fila), referencia)
				i++
			}
		}
	}
}

func identidad(rec registroCartera) string {
	return fmt.Sprintf("%s|%s|%s|%s|%s",
		rec.columna("nombre completo"),
		rec.columna("especialidad"),
		rec.columna("institucion"),
		rec.columna("ciudad"),
		rec.columna("medico id"))
}

// TestClaveMedicoDistingueDaza cubre el ejemplo concreto: las líneas 114 y
// 1080 son dos médicos distintos aunque compartan nombre.
func TestClaveMedicoDistingueDaza(t *testing.T) {
	a := claveMedico("JOSE MARTIN", "DAZA", "", "Do2814", "NEU", "HOSPITAL JAPONES 3ER ANILLO EXTERNO PISO 2$ALEJANDRA")
	b := claveMedico("JOSE MARTIN", "DAZA", "", "Do3407", "NEUM", "ALEJANDRA")
	if a == b {
		t.Errorf("los dos JOSE MARTIN DAZA generaron la misma clave %q", a)
	}
}

// TestCatalogosCubrenLasCarteras reproduce la validación de la etapa sin
// tocar la base: ningún valor crudo de ciudad o especialidad debe quedar
// sin resolver.
func TestCatalogosCubrenLasCarteras(t *testing.T) {
	ciudades, err := catalog.LoadCiudades(filepath.Join(srcRel, "ciudad", "ciudades.csv"))
	if err != nil {
		t.Fatal(err)
	}
	especialidades, err := catalog.LoadEspecialidades(filepath.Join(srcRel, "especialidad", "especialidades.csv"))
	if err != nil {
		t.Fatal(err)
	}

	for _, cartera := range []string{"medicos", "instituciones"} {
		registros, err := leerCartera(filepath.Join(srcRel, cartera, cartera+"_carteras.csv"))
		if err != nil {
			t.Fatal(err)
		}
		var ciudadesRaw, especialidadesRaw []string
		for _, rec := range registros {
			ciudadesRaw = append(ciudadesRaw, rec.columna("ciudad"))
			especialidadesRaw = append(especialidadesRaw, rec.columna("especialidad"))
		}
		if sin := ciudades.SinAlias(ciudadesRaw); len(sin) > 0 {
			t.Fatalf("%s: %d ciudades sin resolver, ejemplos %v", cartera, len(sin), sin[:5])
		}
		if sin := especialidades.SinAlias(especialidadesRaw); len(sin) > 0 {
			t.Fatalf("%s: %d especialidades sin resolver, ejemplos %v", cartera, len(sin), sin[:5])
		}
	}
}

// TestCatalogoCiudadesCubrePrecios asegura que los sufijos de las columnas
// precio_base_* de laboratorios existan como alias de ciudad.
func TestCatalogoCiudadesCubrePrecios(t *testing.T) {
	ciudades, err := catalog.LoadCiudades(filepath.Join(srcRel, "ciudad", "ciudades.csv"))
	if err != nil {
		t.Fatal(err)
	}
	_, columnas, err := leerLaboratorios(filepath.Join(srcRel, "laboratorios", "precios_base_por_departamento.csv"))
	if err != nil {
		t.Fatal(err)
	}
	for _, col := range columnas {
		codigo := col[len("precio_base_"):]
		if _, ok := ciudades.IDByAlias(codigo); !ok {
			t.Errorf("el código %q de %q no es alias de ciudad", codigo, col)
		}
	}
}
