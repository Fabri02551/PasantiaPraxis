// Comando etlinit: corre el ETL una sola vez por base de datos.
//
// Es el que ejecuta docker compose en el primer arranque. Si la base ya tiene
// una corrida exitosa registrada (tabla etl_corrida), sale con código 0 sin
// tocar nada; así el servicio puede depender de él en cada `compose up` sin
// que la app espere una recarga inútil.
//
// El código de salida es el que mira compose: si el ETL falla, sale distinto de
// cero y la API no arranca, porque una app con el esquema vacío no sirve.
package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/config"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/pipeline"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/primercarga"
)

func main() {
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("[etlinit] error conectando a la base de datos: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("[etlinit] base de datos no alcanzable: %v", err)
	}

	if err := primercarga.Preparar(ctx, pool); err != nil {
		log.Fatalf("[etlinit] %v", err)
	}

	// Chequeo rápido sin lock: casi siempre es la respuesta rápida.
	estado, err := primercarga.Pendiente(ctx, pool)
	if err != nil {
		log.Fatalf("[etlinit] %v", err)
	}
	if estado.Corrio {
		log.Printf("[etlinit] la carga inicial ya se hizo el %s; no se corre de nuevo", estado.Cuando.Format(time.RFC3339))
		return
	}

	// Con el lock tomado se repregunta: si otro proceso estaba cargando, este
	// espera y al preguntar de nuevo ya lo encuentra hecho.
	conn, err := primercarga.TomarLock(ctx, pool)
	if err != nil {
		log.Fatalf("[etlinit] %v", err)
	}
	defer primercarga.Liberar(ctx, conn)

	estado, err = primercarga.Pendiente(ctx, pool)
	if err != nil {
		log.Fatalf("[etlinit] %v", err)
	}
	if estado.Corrio {
		log.Printf("[etlinit] otro proceso ya hizo la carga inicial; no se corre de nuevo")
		return
	}

	log.Printf("[etlinit] base vacía: se carga por primera vez (csvs de %s)", cfg.SrcDir)
	inicio := time.Now()
	etl := pipeline.New(cfg, pool)
	corridaErr := etl.Run(ctx)
	fin := time.Now()

	// El registro va con un contexto propio: si la corrida terminó por
	// cancelación o por un error, igual queremos guardar cómo terminó.
	regCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
	defer cancel()
	if err := primercarga.Registrar(regCtx, pool, inicio, fin, corridaErr); err != nil {
		log.Printf("[etlinit] %v", err)
	}

	if corridaErr != nil {
		log.Fatalf("[etlinit] fallo la carga inicial: %v", corridaErr)
	}
	log.Printf("[etlinit] carga inicial completada en %s", fin.Sub(inicio).Round(time.Millisecond))
}
