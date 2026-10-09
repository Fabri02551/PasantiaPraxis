package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port          string
	DatabaseURL   string
	Env           string
	JWTSecret     string
	JWTExpiration time.Duration

	// SMTP con el que la API manda las credenciales de los usuarios que
	// crea (visitadores y administradores). El panel no pide contraseña:
	// la genera acá y la manda por correo. Sin SMTPHost el mailer queda
	// deshabilitado y la contraseña se devuelve una sola vez en la
	// respuesta para que el administrador la reparta a mano.
	SMTPHost       string
	SMTPPort       int
	SMTPUsername   string
	SMTPPassword   string
	SMTPFrom       string
	SMTPFromName   string
	SMTPEncryption string // ssl | starttls | plain

	// AppURL es el enlace de ingreso que se escribe en los correos.
	AppURL string
}

func Load() Config {
	return Config{
		Port:           getEnv("API_PORT", "8080"),
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://localhost:5432/praxis_crm"),
		Env:            getEnv("APP_ENV", "development"),
		JWTSecret:      getEnv("JWT_SECRET", "change-me-in-production"),
		JWTExpiration:  getDurationEnv("JWT_EXPIRATION_HOURS", 24),
		SMTPHost:       getEnv("SMTP_HOST", ""),
		SMTPPort:       getEnvInt("SMTP_PORT", 465),
		SMTPUsername:   getEnv("SMTP_USERNAME", ""),
		SMTPPassword:   getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:       getEnv("SMTP_FROM", ""),
		SMTPFromName:   strings.Trim(getEnv("SMTP_FROM_NAME", ""), `"`),
		SMTPEncryption: strings.ToLower(getEnv("SMTP_ENCRYPTION", "ssl")),
		AppURL:         strings.TrimSuffix(getEnv("APP_URL", "https://crm.laboratoriopraxis.com"), "/"),
	}
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
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
