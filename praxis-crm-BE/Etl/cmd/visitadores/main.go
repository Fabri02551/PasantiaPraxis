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

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/stages"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/visitador"
)

func main() {
	var src string
	var srcDir string
	var logDir string
	flag.StringVar(&src, "src", "src/vistadores/visitadores.csv", "ruta del archivo CSV de visitadores")
	flag.StringVar(&srcDir, "src-dir", "src", "raíz de los CSV, para cargar el catálogo de ciudades")
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

	// El visitador guarda su ciudad, así que el catálogo de ciudades tiene
	// que estar cargado. Este comando no inserta ciudades: solo las lee.
	ciudades, _, err := stages.EtapaCiudad(ctx, pool, filepath.Join(srcDir, "ciudad", "ciudades.csv"))
	if err != nil {
		log.Fatalf("etapa ciudad: %v", err)
	}

	res, err := visitador.Run(ctx, pool, src, ciudades)
	if err != nil {
		log.Fatalf("ETL visitadores: %v", err)
	}

	path, err := visitador.GuardarLog(res, logDir)
	if err != nil {
		log.Fatalf("escribiendo log: %v", err)
	}

	fmt.Printf("ETL visitadores completado: %s\n", visitador.Resumen(res.Resultados))
	fmt.Printf("Log de credenciales: %s\n", path)
}
