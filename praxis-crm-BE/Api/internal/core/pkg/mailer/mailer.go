// Package mailer envía por SMTP los correos de la API: las credenciales de
// los usuarios que crea desde el panel de administración.
//
// Si SMTP_HOST no está configurado el mailer queda deshabilitado y los
// envíos se convierten en un aviso por log: en ese caso la contraseña
// generada se devuelve en la respuesta del alta para que el administrador
// la reparta a mano.
package mailer

import (
	"crypto/tls"
	"errors"
	"fmt"
	"log"
	"mime"
	"net"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/config"
)

var (
	// timeout de cada intento contra el servidor SMTP. La API tiene un
	// WriteTimeout de 10s: dos intentos de 3s con una pausa corta siguen
	// quedando por debajo, así un correo lento no corta la respuesta.
	timeout         = 3 * time.Second
	intentos        = 2
	esperaReintento = 300 * time.Millisecond
)

// Mailer manda correos por el SMTP de la configuración. El receiver puede
// ser nil (o estar deshabilitado): todos los métodos lo toleran.
type Mailer struct {
	Host       string
	Port       int
	Username   string
	Password   string
	From       string
	FromName   string
	Encryption string
	AppURL     string
}

// New devuelve el mailer de la configuración, o nil si no hay SMTP. Un nil
// significa "no enviar", no "error".
func New(cfg config.Config) *Mailer {
	if cfg.SMTPHost == "" {
		return nil
	}
	port := cfg.SMTPPort
	if port == 0 {
		port = 465
	}
	enc := cfg.SMTPEncryption
	if enc == "" {
		enc = "ssl"
	}
	return &Mailer{
		Host:       cfg.SMTPHost,
		Port:       port,
		Username:   cfg.SMTPUsername,
		Password:   cfg.SMTPPassword,
		From:       cfg.SMTPFrom,
		FromName:   cfg.SMTPFromName,
		Encryption: enc,
		AppURL:     strings.TrimSuffix(cfg.AppURL, "/"),
	}
}

// Habilitado dice si hay un SMTP al que apuntar.
func (m *Mailer) Habilitado() bool { return m != nil && m.Host != "" }

// Enviar manda un correo en texto plano a un destinatario, con un reintento
// si el servidor corta la conexión (se vio un "connection reset by peer"
// en producción).
func (m *Mailer) Enviar(destino, asunto, cuerpo string) error {
	if !m.Habilitado() {
		return errors.New("smtp no configurado (SMTP_HOST vacío)")
	}
	if destino == "" {
		return errors.New("sin destinatario")
	}
	msg := m.mensaje(destino, asunto, cuerpo)

	var err error
	for i := 0; i < intentos; i++ {
		if i > 0 {
			time.Sleep(esperaReintento)
		}
		if err = m.entregar(destino, msg); err == nil {
			return nil
		}
	}
	return fmt.Errorf("tras %d intentos: %w", intentos, err)
}

// EnviarCredenciales manda al destinatario su usuario y su contraseña. No
// devuelve la contraseña por el error: en la base solo está el hash.
func (m *Mailer) EnviarCredenciales(destino, nombre, email, password, rol string) error {
	return m.Enviar(destino, "Praxis CRM - tu contraseña de acceso", m.cuerpoCredencial(nombre, email, password, rol))
}

// ============================================================
// Mensaje
// ============================================================

// mensaje arma el correo completo (cabeceras + cuerpo) en CRLF, que es lo
// que exige el protocolo SMTP. El asunto se codifica en QEncoding porque
// trae acentos y el header SMTP es ASCII.
func (m *Mailer) mensaje(destino, asunto, cuerpo string) []byte {
	var b strings.Builder
	fmt.Fprintf(&b, "From: %s\r\n", m.remitente())
	fmt.Fprintf(&b, "To: %s\r\n", destino)
	fmt.Fprintf(&b, "Subject: %s\r\n", mime.QEncoding.Encode("utf-8", asunto))
	fmt.Fprintf(&b, "Date: %s\r\n", time.Now().Format(time.RFC1123Z))
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: text/plain; charset=utf-8\r\n")
	b.WriteString("Content-Transfer-Encoding: 8bit\r\n")
	b.WriteString("\r\n")
	b.WriteString(cuerpoCRLF(cuerpo))
	return []byte(b.String())
}

// remitente arma el header From con nombre y correo.
func (m *Mailer) remitente() string {
	from := m.From
	if from == "" {
		from = m.Username
	}
	if m.FromName == "" {
		return from
	}
	return fmt.Sprintf("%s <%s>", mime.QEncoding.Encode("utf-8", m.FromName), from)
}

// remitenteEnvoltura es la dirección que se le pasa al servidor en MAIL FROM.
func (m *Mailer) remitenteEnvoltura() string {
	if m.From != "" {
		return m.From
	}
	return m.Username
}

// cuerpoCRLF normaliza el cuerpo a \r\n sin duplicar los que ya vinieran.
func cuerpoCRLF(cuerpo string) string {
	cuerpo = strings.ReplaceAll(cuerpo, "\r\n", "\n")
	return strings.ReplaceAll(cuerpo, "\n", "\r\n")
}

// ============================================================
// Cuerpo de correo
// ============================================================

func (m *Mailer) cuerpoCredencial(nombre, email, password, rol string) string {
	if nombre = strings.TrimSpace(nombre); nombre == "" {
		nombre = "(sin nombre)"
	}
	if rol == "" {
		rol = "usuario"
	}

	var b strings.Builder
	fmt.Fprintf(&b, "Hola %s:\n", nombre)
	b.WriteString("\n")
	b.WriteString("Se creó tu usuario en Praxis CRM con estos datos:\n")
	b.WriteString("\n")
	fmt.Fprintf(&b, "  Rol:         %s\n", rol)
	fmt.Fprintf(&b, "  Correo:      %s\n", email)
	fmt.Fprintf(&b, "  Contraseña:  %s\n", password)
	if m.AppURL != "" {
		fmt.Fprintf(&b, "  Ingresa en:  %s\n", m.AppURL)
	}
	b.WriteString("\n")
	b.WriteString("Entrá con ese correo y esa contraseña. Desde tu perfil podés\n")
	b.WriteString("cambiarla cuando quieras.\n")
	b.WriteString("\n")
	b.WriteString("-- \nLaboratorio Praxis\nMensaje automático generado por Praxis CRM.\n")
	return b.String()
}

// ============================================================
// Entrega
// ============================================================

// entregar hace el diálogo SMTP completo contra un único destinatario.
func (m *Mailer) entregar(destino string, msg []byte) error {
	addr := net.JoinHostPort(m.Host, strconv.Itoa(m.Port))

	conn, err := m.conectar(addr)
	if err != nil {
		return err
	}
	defer conn.Close()
	// Sin deadline la llamada se colgaría si el servidor deja el socket
	// abierto y pasaría el WriteTimeout del servidor HTTP.
	_ = conn.SetDeadline(time.Now().Add(timeout))

	c, err := smtp.NewClient(conn, m.Host)
	if err != nil {
		return fmt.Errorf("cliente smtp: %w", err)
	}
	defer func() { _ = c.Quit() }()

	if m.Encryption == "starttls" {
		if ok, _ := c.Extension("STARTTLS"); ok {
			if err := c.StartTLS(&tls.Config{ServerName: m.Host, MinVersion: tls.VersionTLS12}); err != nil {
				return fmt.Errorf("starttls: %w", err)
			}
		}
	}

	if m.Username != "" {
		// PlainAuth exige TLS (o localhost): sin eso devuelve error en
		// vez de mandar la contraseña en claro.
		if err := c.Auth(smtp.PlainAuth("", m.Username, m.Password, m.Host)); err != nil {
			return fmt.Errorf("autenticando: %w", err)
		}
	}

	if err := c.Mail(m.remitenteEnvoltura()); err != nil {
		return fmt.Errorf("MAIL FROM: %w", err)
	}
	if err := c.Rcpt(destino); err != nil {
		return fmt.Errorf("RCPT TO %s: %w", destino, err)
	}

	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("DATA: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		return fmt.Errorf("escribiendo el mensaje: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("cerrando el mensaje: %w", err)
	}
	return nil
}

// conectar abre el socket según el cifrado pedido: ssl/tls hace el handshake
// desde el principio (puerto 465), starttls y plain conectan en claro y
// negocian después.
func (m *Mailer) conectar(addr string) (net.Conn, error) {
	dialer := &net.Dialer{Timeout: timeout}
	if m.Encryption == "ssl" || m.Encryption == "tls" || m.Encryption == "465" {
		conn, err := tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{
			ServerName: m.Host,
			MinVersion: tls.VersionTLS12,
		})
		if err != nil {
			return nil, fmt.Errorf("conectando por TLS a %s: %w", addr, err)
		}
		return conn, nil
	}
	conn, err := dialer.Dial("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("conectando a %s: %w", addr, err)
	}
	return conn, nil
}

// AvisoCredenciales escribe en el log de la API que no se pudo mandar el
// correo. La contraseña no se registra: solo queda el hash en la base y la
// copia que la API devuelve en la respuesta del alta.
func AvisoCredenciales(destino string, err error) {
	log.Printf("[mailer] no se pudieron enviar las credenciales a %s: %v", destino, err)
}
