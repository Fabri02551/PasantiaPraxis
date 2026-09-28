package config

import "os"

type Config struct {
	DatabaseURL   string
	BatchSize     int
	ScheduleEvery string
}

func Load() Config {
	return Config{
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://localhost:5432/praxis_crm"),
		BatchSize:     1000,
		ScheduleEvery: getEnv("ETL_EVERY", "24h"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
