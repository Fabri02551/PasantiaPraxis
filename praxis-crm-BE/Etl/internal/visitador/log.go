package visitador

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// GuardarLog escribe el detalle de una corrida de visitadores, incluidas las
// contraseñas generadas para los visitadores nuevos. Se usa tanto desde
// cmd/visitadores como desde el pipeline, para que una corrida por cmd/etl
// no pierda las credenciales recién creadas.
func GuardarLog(res ResultadoRun, logDir string) (string, error) {
	if err := os.MkdirAll(logDir, 0o755); err != nil {
		return "", err
	}
	name := fmt.Sprintf("visitadores_%s.log", time.Now().Format("20060102_150405"))
	path := filepath.Join(logDir, name)

	f, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	now := func() string { return time.Now().Format("2006-01-02 15:04:05") }
	w := func(format string, a ...any) {
		fmt.Fprintf(f, "[%s] %s\n", now(), fmt.Sprintf(format, a...))
	}

	w("======================== ETL VISITADORES ========================")
	w("Fuente: %s", res.Fuente)
	w("Departamentos asegurados (%d): %v", len(res.Departamentos), res.Departamentos)
	w("---------------------------------------------------------------")

	for i, r := range res.Resultados {
		w("%d. %s %s %s", i+1, r.Nombre, r.PrimerApellido, r.SegundoApellido)
		w("   Email: %s", r.Email)
		w("   CI: %s | Departamento: %s", r.CI, r.Ciudad)
		if r.Password != "" {
			w("   Password: %s", r.Password)
		}
		w("   Resultado: %s | %s", r.Estado, r.Detalle)
	}

	w("---------------------------------------------------------------")
	w("Resumen: %s", Resumen(res.Resultados))
	w("===============================================================")
	return path, nil
}
