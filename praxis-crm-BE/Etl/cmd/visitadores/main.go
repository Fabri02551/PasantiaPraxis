package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/config"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/mailer"
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

	// Mismo envío que hace el pipeline completo: cada visitador insertado
	// recibe su contraseña y ETL_ADMIN_EMAIL el resumen. Un fallo de SMTP
	// no cambia el resultado de la carga.
	cfg := config.Load()
	var creds []mailer.Credencial
	for _, r := range res.Resultados {
		if r.Estado != "insertado" || r.Password == "" {
			continue
		}
		creds = append(creds, mailer.Credencial{
			Nombre:   strings.TrimSpace(r.Nombre + " " + r.PrimerApellido + " " + r.SegundoApellido),
			Email:    r.Email,
			Password: r.Password,
			Rol:      "visitador",
		})
	}
	m := mailer.New(cfg)
	switch {
	case len(creds) == 0:
		fmt.Println("Correos: sin credenciales nuevas")
	case !m.Habilitado():
		fmt.Printf("Correos: no enviados, SMTP_HOST sin configurado (%d credenciales solo en %s)\n", len(creds), logDir)
	default:
		// Cuenta aparte lo que va a la casilla de cada visitador y lo que
		// va al resumen de ETL_ADMIN_EMAIL, para que el log deje claro que
		// cada uno recibe el suyo.
		individuales := 0
		for _, c := range creds {
			if cfg.AdminEmail == "" || !strings.EqualFold(c.Email, cfg.AdminEmail) {
				individuales++
			}
		}
		resumen := 0
		if cfg.AdminEmail != "" {
			resumen = 1
		}
		enviados, fallidos, errs := m.NotificarNuevos(creds, cfg.AdminEmail)
		fmt.Printf("Correos: enviados=%d fallidos=%d | a su correo: %d | resumen para el admin: %d\n",
			enviados, fallidos, individuales, resumen)
		for _, e := range errs {
			fmt.Printf("  error: %s\n", e)
		}
	}
}
