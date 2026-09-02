package main

import (
	"context"
	"log"
	"time"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/config"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/pipeline"
)

func main() {
	cfg := config.Load()

	for {
		start := time.Now()
		if err := pipeline.New(cfg).Run(context.Background()); err != nil {
			log.Printf("fallo la corrida: %v", err)
		}
		log.Printf("corrida completada en %s; próxima en %s", time.Since(start), cfg.ScheduleEvery)

		d, err := time.ParseDuration(cfg.ScheduleEvery)
		if err != nil {
			log.Fatalf("ETL_EVERY inválido: %v", err)
		}
		time.Sleep(d)
	}
}
