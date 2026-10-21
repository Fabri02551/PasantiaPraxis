package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/config"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/pipeline"
)

func main() {
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("error conectando a la base de datos: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("base de datos no alcanzable: %v", err)
	}

	etl := pipeline.New(cfg, pool)

	// Con ETL_ONCE la corrida termina al terminar las etapas, que es lo que
	// se usa para probar el ETL a mano o en un job de CI.
	if cfg.Once {
		if err := etl.Run(ctx); err != nil {
			log.Fatalf("fallo la corrida: %v", err)
		}
		return
	}

	// Sin ETL_ONCE el proceso queda repitiendo. La primera corrida es
	// inmediata; si falla se reintenta cada ScheduleEvery en vez de morir,
	// porque en desarrollo la base puede no estar lista todavía.
	correr := func() {
		start := time.Now()
		if err := etl.Run(ctx); err != nil {
			log.Printf("fallo la corrida: %v", err)
		}
		log.Printf("corrida completada en %s; próxima en %s", time.Since(start).Round(time.Millisecond), cfg.ScheduleEvery)
	}

	intervalo, err := time.ParseDuration(cfg.ScheduleEvery)
	if err != nil {
		log.Fatalf("ETL_EVERY inválido: %v", err)
	}

	ticker := time.NewTicker(intervalo)
	defer ticker.Stop()
	correr()
	for {
		select {
		case <-ctx.Done():
			log.Println("señal recibida, cerrando el ETL")
			return
		case <-ticker.C:
			correr()
		}
	}
}
