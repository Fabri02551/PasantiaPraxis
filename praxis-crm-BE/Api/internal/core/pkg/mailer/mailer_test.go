package mailer

import (
	"strings"
	"testing"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/config"
)

func TestNewSinSMTP(t *testing.T) {
	if m := New(config.Config{}); m != nil {
		t.Fatal("sin SMTP_HOST se espera un mailer nil")
	}
	var deshabilitado *Mailer
	if deshabilitado.Habilitado() {
		t.Error("un mailer nil no está habilitado")
	}
	if err := deshabilitado.Enviar("a@x.com", "hola", "mundo"); err == nil {
		t.Error("sin SMTP el envío debe fallar, no quedar en silencio")
	}
}

func TestNewConSMTP(t *testing.T) {
	m := New(config.Config{SMTPHost: "smtp.test", AppURL: "https://crm.test"})
	if !m.Habilitado() {
		t.Fatal("con SMTP_HOST se espera un mailer habilitado")
	}
	if m.Port != 465 {
		t.Errorf("puerto por defecto: se espera 465, llegó %d", m.Port)
	}
	if m.Encryption != "ssl" {
		t.Errorf("cifrado por defecto: se espera ssl, llegó %q", m.Encryption)
	}
	if m.AppURL != "https://crm.test" {
		t.Errorf("AppURL: se espera https://crm.test, llegó %q", m.AppURL)
	}
}

func TestEnviarSinDestino(t *testing.T) {
	m := New(config.Config{SMTPHost: "smtp.test"})
	if err := m.Enviar("", "asunto", "cuerpo"); err == nil {
		t.Error("un destinatario vacío debe dar error")
	}
}

func TestCuerpoCredencial(t *testing.T) {
	m := New(config.Config{SMTPHost: "smtp.test", AppURL: "https://crm.test"})
	cuerpo := m.cuerpoCredencial("Ana Perez", "ana@x.com", "Abc12345", "visitador")

	for _, esperado := range []string{"Ana Perez", "ana@x.com", "Abc12345", "visitador", "https://crm.test"} {
		if !strings.Contains(cuerpo, esperado) {
			t.Errorf("el cuerpo debería mencionar %q", esperado)
		}
	}
}

// El mensaje tiene que salir en CRLF con el asunto codificado: el header
// SMTP es ASCII y el asunto trae acentos.
func TestMensaje(t *testing.T) {
	m := New(config.Config{SMTPHost: "smtp.test", SMTPFrom: "soporte@x.com", SMTPFromName: "Praxis"})
	msg := string(m.mensaje("ana@x.com", "Praxis CRM - tu contraseña de acceso", "hola\nchau"))

	if !strings.Contains(msg, "From: Praxis <soporte@x.com>\r\n") {
		t.Errorf("falta el header From:\n%s", msg)
	}
	if !strings.Contains(msg, "To: ana@x.com\r\n") {
		t.Errorf("falta el header To:\n%s", msg)
	}
	if !strings.Contains(msg, "Subject: =?utf-8?q?Praxis_CRM_-_tu_contrase=C3=B1a_de_acceso?=") {
		t.Errorf("el asunto debería ir codificado en QEncoding:\n%s", msg)
	}
	if !strings.HasSuffix(msg, "\r\nhola\r\nchau") {
		t.Errorf("el cuerpo debe ir en CRLF:\n%q", msg)
	}
}
