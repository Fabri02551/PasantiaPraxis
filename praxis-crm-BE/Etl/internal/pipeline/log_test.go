package pipeline

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/stages"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/visitador"
)

func TestResumenRunEscribirLog(t *testing.T) {
	dir := t.TempDir()
	run := ResumenRun{
		Inicio: time.Date(2026, 9, 28, 10, 0, 0, 0, time.Local),
		Fin:    time.Date(2026, 9, 28, 10, 0, 3, 0, time.Local),
		Error:  errors.New("etapa laboratorio: estalló"),
		Fuentes: []string{
			"src/ciudad/ciudades.csv",
			"src/medicos/medicos_carteras.csv",
		},
		Ciudad: stages.Resumen{Etapa: "ciudad", Insertados: 18, Actualizados: 2},
		Medico: stages.Resumen{
			Etapa:   "medico",
			Errores: 2,
			Detalle: []string{"fila 45 (JOSE DAZA): sin especialidad", "fila 90 (X): sin institución"},
		},
		Visitador: visitador.ResultadoRun{
			Resultados: []visitador.Result{
				{Nombre: "Luis", Estado: "insertado"},
				{Nombre: "Ana", Estado: "error", Detalle: "correo duplicado"},
			},
		},
		LogVisitadores: "logs/visitadores_20260928_101010.log",
	}

	if err := run.escribirLog(dir); err != nil {
		t.Fatalf("escribirLog: %v", err)
	}

	archivos, err := filepath.Glob(filepath.Join(dir, "etl_*.log"))
	if err != nil || len(archivos) != 1 {
		t.Fatalf("no se generó el log de corrida: %v", err)
	}
	b, err := os.ReadFile(archivos[0])
	if err != nil {
		t.Fatal(err)
	}
	texto := string(b)

	casos := []string{
		"[ciudad]",
		"[medico] fila 45 (JOSE DAZA): sin especialidad",
		"[medico] fila 90 (X): sin institución",
		"[ciudad]",
		"[visitador] Ana: correo duplicado",
		"[etl] etapa laboratorio: estalló",
		"logs/visitadores_20260928_101010.log",
	}
	for _, c := range casos {
		if !strings.Contains(texto, c) {
			t.Errorf("el log no contiene %q", c)
		}
	}
}
