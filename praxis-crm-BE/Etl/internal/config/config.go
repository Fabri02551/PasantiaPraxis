package config

import "os"

type Config struct {
	DatabaseURL   string
	BatchSize     int
	ScheduleEvery string
	// SrcDir es la raíz de los CSV. Se resuelve desde el directorio de
	// trabajo actual para que el ETL funcione igual dentro y fuera de Docker.
	SrcDir string
	// Once corre el ETL una sola vez y termina. Por defecto es false y el
	// proceso se queda repitiendo cada ScheduleEvery, que es el
	// comportamiento histórico de cmd/etl.
	Once bool
}

func Load() Config {
	return Config{
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://localhost:5432/praxis_crm"),
		BatchSize:     1000,
		ScheduleEvery: getEnv("ETL_EVERY", "24h"),
		SrcDir:        getEnv("ETL_SRC_DIR", "src"),
		Once:          getEnv("ETL_ONCE", "") != "",
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
