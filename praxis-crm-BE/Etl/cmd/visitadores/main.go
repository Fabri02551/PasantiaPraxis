package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/visitador"
)

func main() {
	var src string
	var logDir string
	flag.StringVar(&src, "src", "src/vistadores/visitadores.csv", "ruta del archivo CSV de visitadores")
	flag.StringVar(&logDir, "logs", "logs", "directorio donde se escribe el log")
	flag.Parse()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://praxis:praxis_secret@localhost:5432/praxis_crm?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("error conectando a la base de datos: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("base de datos no alcanzable: %v", err)
	}

	res, err := visitador.Run(ctx, pool, src)
	if err != nil {
		log.Fatalf("ETL visitadores: %v", err)
	}

	if err := escribirLog(res, logDir); err != nil {
		log.Fatalf("escribiendo log: %v", err)
	}

	fmt.Printf("ETL visitadores completado: %s\n", visitador.Resumen(res.Resultados))
}

func escribirLog(res visitador.ResultadoRun, logDir string) error {
	if err := os.MkdirAll(logDir, 0o755); err != nil {
		return err
	}
	name := fmt.Sprintf("visitadores_%s.log", time.Now().Format("20060102_150405"))
	path := filepath.Join(logDir, name)

	f, err := os.Create(path)
	if err != nil {
		return err
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
		w("   CI: %s | Departamento: %s", r.CI, orGuion(r.Ciudad))
		if r.Password != "" {
			w("   Password: %s", r.Password)
		}
		w("   Resultado: %s | %s", r.Estado, r.Detalle)
	}

	w("---------------------------------------------------------------")
	w("Resumen: %s", visitador.Resumen(res.Resultados))
	w("===============================================================")
	return nil
}

func orGuion(s string) string {
	if s == "" {
		return "-"
	}
	return s
}
