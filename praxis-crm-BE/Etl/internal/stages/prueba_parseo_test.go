package stages

import (
	"path/filepath"
	"strings"
	"testing"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/catalog"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/visitador"
)

// srcRel es la raíz de los CSV tal como queda en ejecución.
const srcRel = "../../src"

// TestLeerCarterasRevisaQueElParsingNoPierdaFilas comprueba que los CSV de
// cartera se lean completos. encoding/csv con LazyQuotes fusionaba las
// líneas cuando el archivo traía comillas mal cerradas, así que el conteo
// de filas es la forma más barata de detectar que el parser se rompió.
func TestLeerCarterasRevisaQueElParsingNoPierdaFilas(t *testing.T) {
	casos := []struct {
		archivo string
		want    int
	}{
		{filepath.Join(srcRel, "medicos", "medicos_carteras.csv"), 1892},
		{filepath.Join(srcRel, "instituciones", "instituciones_carteras.csv"), 284},
	}

	for _, c := range casos {
		t.Run(filepath.Base(c.archivo), func(t *testing.T) {
			registros, err := leerCartera(c.archivo)
			if err != nil {
				t.Fatal(err)
			}
			if len(registros) != c.want {
				t.Errorf("se leyeron %d filas, se esperaban %d", len(registros), c.want)
			}
		})
	}
}

// TestColumnaNoDistingueMayusculasNiEspacios cubre el acceso a las columnas:
// los CSV traen nombres en mayúsculas con acentos y los distintos programas
// los piden en minúsculas.
func TestColumnaNoDistingueMayusculasNiEspacios(t *testing.T) {
	registros, err := leerCartera(filepath.Join(srcRel, "medicos", "medicos_carteras.csv"))
	if err != nil {
		t.Fatal(err)
	}
	primera := registros[0]

	for _, columna := range []string{
		"visitador asignado", "nombre completo", "sexo", "especialidad",
		"ciudad", "telefono", "programacion",
	} {
		if got := primera.columna(columna); got == "" {
			t.Errorf("columna %q vacía en la primera fila", columna)
		}
	}
}

// TestLaboratoriosDetectaColumnasDePrecio comprueba que se reconozcan las
// cinco columnas precio_base_* y que se traduzcan a ciudades del catálogo.
func TestLaboratoriosDetectaColumnasDePrecio(t *testing.T) {
	filas, columnas, err := leerLaboratorios(filepath.Join(srcRel, "laboratorios", "precios_base_por_departamento.csv"))
	if err != nil {
		t.Fatal(err)
	}

	want := []string{
		"precio_base_cbba", "precio_base_lpz", "precio_base_scz",
		"precio_base_sucre", "precio_base_tarija",
	}
	if len(columnas) != len(want) {
		t.Fatalf("se detectaron %d columnas de precio (%v), se esperaban %d", len(columnas), columnas, len(want))
	}
	for i, col := range want {
		if columnas[i] != col {
			t.Errorf("columna de precio %d = %q, se esperaba %q", i, columnas[i], col)
		}
	}

	// Un estudio cuyo nombre lleva coma es el caso que rompía el parser
	// original: si la fila no tiene los 9 campos, el precio quedó corrido.
	for _, fila := range filas {
		if !strings.Contains(fila["estudio"], ",") {
			continue
		}
		for _, col := range columnas {
			if fila[col] == "" {
				t.Fatalf("estudio %q tiene la columna %q vacía: el parsing se corrió", fila["estudio"], col)
			}
		}
		break
	}
}

// TestMatriculaEsUnicaPorPersona cubre que dos médicos del mismo lote no
// puedan obtener la misma matrícula, que es la columna UNIQUE que identifica
// al médico.
func TestMatriculaEsUnicaPorPersona(t *testing.T) {
	vistos := make(map[string]bool)
	for id := 1; id <= 3000; id++ {
		m := matriculaDe(id)
		if vistos[m] {
			t.Fatalf("matrícula repetida: %s", m)
		}
		vistos[m] = true
	}
	if matriculaDe(42) != "M-000042" {
		t.Errorf("matriculaDe(42) = %q, se esperaba M-000042", matriculaDe(42))
	}
}

// TestCiudadPrefiereLaColumnaYCaeAlVisitador cubre el orden de resolución
// de la ciudad de un médico: primero la columna CIUDAD, y solo si el
// catálogo no la reconoce, la ciudad de su visitador asignado.
func TestCiudadPrefiereLaColumnaYCaeAlVisitador(t *testing.T) {
	ciudades, err := catalog.LoadCiudades(filepath.Join(srcRel, "ciudad", "ciudades.csv"))
	if err != nil {
		t.Fatal(err)
	}
	// Los ids del catálogo arrancan en 1 hasta que la etapa ciudad los
	// ata a la base; para esta prueba solo importa que SCZ resuelva.
	scz, ok := ciudades.IDByAlias("SCZ")
	if !ok {
		t.Fatal("el catálogo no reconoce SCZ")
	}

	conCiudad := registroCartera{"ciudad": "SCZ"}
	if id := idCiudad(conCiudad, ciudades, visitador.NewMapa(), nil); id == nil || *id != scz {
		t.Errorf("con CIUDAD=SCZ se esperaba la ciudad %d, se obtuvo %v", scz, id)
	}

	// Sin columna CIUDAD no puede resolverse sin visitador, y ciudad es
	// nullable en persona, así que NULL es la respuesta correcta.
	vacio := registroCartera{}
	if id := idCiudad(vacio, ciudades, visitador.NewMapa(), nil); id != nil {
		t.Errorf("sin CIUDAD ni visitador se esperaba NULL, se obtuvo %d", *id)
	}
}
