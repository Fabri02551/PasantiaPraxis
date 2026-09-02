package config

import (
	"os"
	"time"
)

type Config struct {
	Port          string
	DatabaseURL   string
	Env           string
	JWTSecret     string
	JWTExpiration time.Duration
}

func Load() Config {
	return Config{
		Port:          getEnv("API_PORT", "8080"),
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://localhost:5432/praxis_crm"),
		Env:           getEnv("APP_ENV", "development"),
		JWTSecret:     getEnv("JWT_SECRET", "change-me-in-production"),
		JWTExpiration: getDurationEnv("JWT_EXPIRATION_HOURS", 24),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getDurationEnv(key string, fallbackHours int) time.Duration {
	if v := os.Getenv(key); v != "" {
		if h, err := time.ParseDuration(v + "h"); err == nil {
			return h
		}
	}
	return time.Duration(fallbackHours) * time.Hour
}
