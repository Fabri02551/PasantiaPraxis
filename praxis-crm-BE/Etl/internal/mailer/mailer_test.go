package mailer

import (
	"errors"
	"os"
	"strings"
	"testing"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/config"
)

// Los tests no esperan los reintentos reales: llegan igual, en 0 ms.
func TestMain(m *testing.M) {
	esperaReintento = 0
	os.Exit(m.Run())
}

func TestNewSinSMTPQuedaDeshabilitado(t *testing.T) {
	if m := New(config.Config{}); m != nil {
		t.Fatalf("sin SMTP_HOST se espera un mailer nil, llegó %#v", m)
	}
	if m := New(config.Config{}); m.Habilitado() {
		t.Error("un mailer nil no está habilitado")
	}

	m := New(config.Config{SMTPHost: "smtp.test"})
	if m == nil || !m.Habilitado() {
		t.Fatalf("con SMTP_HOST se espera un mailer habilitado, llegó %#v", m)
	}
	if m.Port != 465 {
		t.Errorf("puerto por defecto: se espera 465, llegó %d", m.Port)
	}
	if m.Encryption != "ssl" {
		t.Errorf("cifrado por defecto: se espera ssl, llegó %q", m.Encryption)
	}
}

func TestMensaje(t *testing.T) {
	m := &Mailer{From: "soporte@laboratoriopraxis.com", FromName: "Laboratorio Praxis"}
	msg := string(m.mensaje(
		[]string{"ana@x.com", "bruno@x.com"},
		"Praxis CRM - tu contraseña de acceso",
		"Hola Ana:\n\nTu contraseña es abc123.\n",
	))

	// SMTP exige CRLF: no puede quedar un \n suelto.
	sinCRLF := strings.ReplaceAll(msg, "\r\n", "")
	if strings.Contains(sinCRLF, "\n") || strings.Contains(sinCRLF, "\r") {
		t.Errorf("el mensaje no está en CRLF:\n%s", msg)
	}

	if !strings.Contains(msg, "From: Laboratorio Praxis <soporte@laboratoriopraxis.com>\r\n") {
		t.Errorf("falta el header From:\n%s", msg)
	}
	if !strings.Contains(msg, "To: ana@x.com, bruno@x.com\r\n") {
		t.Errorf("falta el header To:\n%s", msg)
	}
	// El asunto trae ñ, así que tiene que ir codificado en QEncoding.
	if !strings.Contains(msg, "Subject: =?utf-8?q?") {
		t.Errorf("el asunto acentuado no se codificó:\n%s", msg)
	}
	if !strings.Contains(msg, "Content-Type: text/plain; charset=utf-8\r\n") {
		t.Errorf("falta declarar el charset utf-8:\n%s", msg)
	}
	if !strings.Contains(msg, "\r\n\r\nHola Ana:\r\n") {
		t.Errorf("falta la línea en blanco que separa cabecera de cuerpo:\n%s", msg)
	}
}

func TestCuerpoCredencial(t *testing.T) {
	m := &Mailer{AppURL: "https://crm.laboratoriopraxis.com"}
	cuerpo := m.cuerpoCredencial(Credencial{
		Nombre:   "Ana García",
		Email:    "ana@x.com",
		Password: "Abc123",
		Rol:      "visitador",
	})

	for _, esperado := range []string{"Ana García", "ana@x.com", "Abc123", "visitador", "https://crm.laboratoriopraxis.com"} {
		if !strings.Contains(cuerpo, esperado) {
			t.Errorf("el cuerpo no menciona %q:\n%s", esperado, cuerpo)
		}
	}
}

func TestCuerpoResumenListaTodas(t *testing.T) {
	m := &Mailer{AppURL: "https://crm.laboratoriopraxis.com"}
	cuerpo := m.cuerpoResumen([]Credencial{
		{Nombre: "Nicolas Toco Yucra", Email: "admin@x.com", Password: "AAAA", Rol: "admin"},
		{Nombre: "Ana García", Email: "ana@x.com", Password: "BBBB", Rol: "visitador"},
	})

	for _, esperado := range []string{"Nicolas Toco Yucra", "admin@x.com", "AAAA", "Ana García", "ana@x.com", "BBBB"} {
		if !strings.Contains(cuerpo, esperado) {
			t.Errorf("el resumen no menciona %q:\n%s", esperado, cuerpo)
		}
	}
}

func TestNotificarNuevosSinSMTP(t *testing.T) {
	var m *Mailer
	enviados, fallidos, errs := m.NotificarNuevos([]Credencial{{Email: "a@x.com", Password: "p"}}, "admin@x.com")
	if enviados != 0 || fallidos != 0 || len(errs) != 0 {
		t.Errorf("sin SMTP no se manda nada: enviados=%d fallidos=%d errs=%v", enviados, fallidos, errs)
	}
}

func TestNotificarNuevos(t *testing.T) {
	var enviadosA [][]string
	var mensajes []string
	m := &Mailer{
		Host: "smtp.test",
		From: "soporte@x.com",
		enviarFunc: func(destinos []string, msg []byte) error {
			enviadosA = append(enviadosA, destinos)
			mensajes = append(mensajes, string(msg))
			return nil
		},
	}

	creds := []Credencial{
		{Nombre: "Ana García", Email: "ana@x.com", Password: "AAA", Rol: "visitador"},
		// La casilla de copia no debe recibir su correo individual:
		// el resumen ya le llega con todo adentro.
		{Nombre: "Nicolas Toco", Email: "admin@x.com", Password: "BBB", Rol: "admin"},
	}

	enviados, fallidos, errs := m.NotificarNuevos(creds, "admin@x.com")
	if enviados != 2 || fallidos != 0 || len(errs) != 0 {
		t.Fatalf("enviados=%d fallidos=%d errs=%v", enviados, fallidos, errs)
	}
	if len(enviadosA) != 2 {
		t.Fatalf("se esperaban 2 envíos (individual + resumen), llegaron %d", len(enviadosA))
	}
	if got := enviadosA[0]; len(got) != 1 || got[0] != "ana@x.com" {
		t.Errorf("el primer envío tiene que ser al visitador: %v", got)
	}
	if got := enviadosA[1]; len(got) != 1 || got[0] != "admin@x.com" {
		t.Errorf("el resumen tiene que ir al admin: %v", got)
	}
	if strings.Contains(mensajes[0], "BBB") {
		t.Error("el correo individual de Ana no puede llevar la contraseña de Nicolás")
	}
	if !strings.Contains(mensajes[1], "AAA") || !strings.Contains(mensajes[1], "BBB") {
		t.Error("el resumen tiene que listar todas las credenciales")
	}
}

func TestNotificarNuevosCuentaFallas(t *testing.T) {
	m := &Mailer{
		Host: "smtp.test",
		enviarFunc: func(destinos []string, msg []byte) error {
			if destinos[0] == "roto@x.com" {
				return errors.New("550 relay denied")
			}
			return nil
		},
	}

	enviados, fallidos, errs := m.NotificarNuevos([]Credencial{
		{Nombre: "Ana", Email: "roto@x.com", Password: "AAA"},
		{Nombre: "Bruno", Email: "bueno@x.com", Password: "BBB"},
	}, "")

	if enviados != 1 || fallidos != 1 || len(errs) != 1 {
		t.Fatalf("enviados=%d fallidos=%d errs=%v", enviados, fallidos, errs)
	}
	if !strings.Contains(errs[0], "roto@x.com") || !strings.Contains(errs[0], "relay denied") {
		t.Errorf("el error tiene que decir a quién falló: %q", errs[0])
	}
}

func TestNotificarNuevosSinCredencialesNoManda(t *testing.T) {
	llamado := false
	m := &Mailer{
		Host: "smtp.test",
		enviarFunc: func([]string, []byte) error {
			llamado = true
			return nil
		},
	}

	// Nada nuevo (visitas actualizados) y una credencial incompleta.
	enviados, fallidos, errs := m.NotificarNuevos([]Credencial{
		{Email: "sin-clave@x.com"},
		{Email: "", Password: "p"},
	}, "admin@x.com")

	if llamado || enviados != 0 || fallidos != 0 || len(errs) != 0 {
		t.Errorf("no debería enviarse nada: llamado=%v enviados=%d fallidos=%d errs=%v", llamado, enviados, fallidos, errs)
	}
}

func TestEntregarReintentaTrasFalloTransitorio(t *testing.T) {
	intentosPrevios := intentos
	intentos = 3
	defer func() { intentos = intentosPrevios }()

	fallos := 0
	m := &Mailer{
		Host: "smtp.test",
		enviarFunc: func([]string, []byte) error {
			fallos++
			if fallos < 3 {
				return errors.New("read: connection reset by peer")
			}
			return nil
		},
	}

	if err := m.Enviar([]string{"a@x.com"}, "asunto", "cuerpo"); err != nil {
		t.Fatalf("un corte transitorio tenía que superarse: %v", err)
	}
	if fallos != 3 {
		t.Errorf("se esperaban 3 intentos, hubo %d", fallos)
	}
}

func TestEntregarAgotaLosIntentos(t *testing.T) {
	intentosPrevios := intentos
	intentos = 3
	defer func() { intentos = intentosPrevios }()

	fallos := 0
	m := &Mailer{
		Host: "smtp.test",
		enviarFunc: func([]string, []byte) error {
			fallos++
			return errors.New("550 relay denied")
		},
	}

	err := m.Enviar([]string{"a@x.com"}, "asunto", "cuerpo")
	if err == nil {
		t.Fatal("con el servidor siempre caído tenía que devolver error")
	}
	if fallos != intentos {
		t.Errorf("se esperaban %d intentos, hubo %d", intentos, fallos)
	}
	if !strings.Contains(err.Error(), "tras 3 intentos") {
		t.Errorf("el error tendría que decir cuántos intentos se hicieron: %v", err)
	}
}

func TestEntregarSinReintentosDeMasEnElExito(t *testing.T) {
	fallos := 0
	m := &Mailer{
		Host: "smtp.test",
		enviarFunc: func([]string, []byte) error {
			fallos++
			return nil
		},
	}

	if err := m.Enviar([]string{"a@x.com"}, "asunto", "cuerpo"); err != nil {
		t.Fatalf("enviar: %v", err)
	}
	if fallos != 1 {
		t.Errorf("con un envío exitoso no debería reintentarse: %d llamadas", fallos)
	}
}
