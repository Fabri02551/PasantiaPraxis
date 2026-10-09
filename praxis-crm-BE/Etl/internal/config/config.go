package config

import (
	"os"
	"strconv"
	"strings"
)

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

	// SMTP con el que el ETL manda las credenciales de los usuarios que
	// crea. Si SMTPHost queda vacío el mailer se deshabilita y las
	// contraseñas quedan solo en logs/: el ETL nunca falla por correo.
	SMTPHost       string
	SMTPPort       int
	SMTPUsername   string
	SMTPPassword   string
	SMTPFrom       string
	SMTPFromName   string
	SMTPEncryption string // ssl | starttls | plain

	// AdminEmail es la cuenta administradora que siembra el ETL en cada
	// corrida y también la casilla que recibe copia de las credenciales
	// nuevas. Vacío desactiva la siembra.
	AdminEmail string

	// AppURL es el enlace de ingreso que se escribe en los correos.
	AppURL string
}

func Load() Config {
	return Config{
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://localhost:5432/praxis_crm"),
		BatchSize:      1000,
		ScheduleEvery:  getEnv("ETL_EVERY", "24h"),
		SrcDir:         getEnv("ETL_SRC_DIR", "src"),
		Once:           getEnv("ETL_ONCE", "") != "",
		SMTPHost:       getEnv("SMTP_HOST", ""),
		SMTPPort:       getEnvInt("SMTP_PORT", 465),
		SMTPUsername:   getEnv("SMTP_USERNAME", ""),
		SMTPPassword:   getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:       getEnv("SMTP_FROM", ""),
		SMTPFromName:   strings.Trim(getEnv("SMTP_FROM_NAME", ""), `"`),
		SMTPEncryption: strings.ToLower(getEnv("SMTP_ENCRYPTION", "ssl")),
		AdminEmail:     getEnv("ETL_ADMIN_EMAIL", "nicolastocoyucra@gmail.com"),
		AppURL:         strings.TrimSuffix(getEnv("APP_URL", "https://crm.laboratoriopraxis.com"), "/"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
