// Package mailer envía por SMTP los correos del ETL: las credenciales de los
// usuarios que crea y la copia que recibe el administrador.
//
// Si SMTP_HOST no está configurado el mailer queda deshabilitado y los envíos
// se convierten en un aviso por log: las contraseñas siguen saliendo por
// logs/visitadores_*.log y el ETL nunca falla por un correo que no se pudo
// mandar (etlinit abortaría y la API no arrancaría).
package mailer

import (
	"crypto/tls"
	"errors"
	"fmt"
	"mime"
	"net"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/config"
)

// Timeout de conexión y de escritura contra el servidor SMTP.
const timeout = 15 * time.Second

// El SMTP de producción corta conexiones de vez en cuando (se vio un
// "connection reset by peer" a mitad de una corrida de 13 correos): como el
// envío es idempotente para el destinatario, se reintenta antes de darlo por
// perdido. Las esperas son variables y no constantes para que los tests no
// tengan que esperar.
var (
	intentos        = 3
	esperaReintento = 1500 * time.Millisecond
)

// Mailer manda correos por el SMTP de la configuración. El receiver puede ser
// nil (o estar deshabilitado): todos los métodos están pensados para
// tolerarlo sin romper la corrida.
type Mailer struct {
	Host       string
	Port       int
	Username   string
	Password   string
	From       string
	FromName   string
	Encryption string
	AppURL     string

	// enviarFunc reemplaza la entrega real. Solo la usan los tests: en
	// producción siempre está en nil y manda por el socket SMTP.
	enviarFunc func(destinos []string, msg []byte) error
}

// Credencial es una cuenta creada por el ETL que todavía no se entregó.
type Credencial struct {
	Nombre   string
	Email    string
	Password string
	Rol      string
}

// New devuelve el mailer de la configuración, o nil si no hay SMTP. Un
// nil significa "no enviar", no "error".
func New(cfg config.Config) *Mailer {
	if cfg.SMTPHost == "" {
		return nil
	}
	port := cfg.SMTPPort
	if port == 0 {
		port = 465
	}
	enc := strings.ToLower(cfg.SMTPEncryption)
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

// Enviar manda un correo en texto plano a todos los destinatarios.
func (m *Mailer) Enviar(destinos []string, asunto, cuerpo string) error {
	if !m.Habilitado() {
		return errors.New("smtp no configurado (SMTP_HOST vacío)")
	}
	if len(destinos) == 0 {
		return errors.New("sin destinatarios")
	}
	msg := m.mensaje(destinos, asunto, cuerpo)
	return m.entregar(destinos, msg)
}

// NotificarNuevos manda a cada cuenta recién creada su propia contraseña y,
// si copia no está vacío, un resumen con todas las credenciales de la corrida
// a esa casilla. Devuelve cuántos correos salieron, cuántos fallaron y los
// errores (uno por fallo) para que el pipeline los registre sin abortar.
func (m *Mailer) NotificarNuevos(nuevos []Credencial, copia string) (enviados, fallidos int, errs []string) {
	if !m.Habilitado() {
		return 0, 0, nil
	}

	// El resumen se arma con todas las cuentas nuevas; si alguna no trae
	// contraseña (no debería), se ignora en vez de mandar un correo vacío.
	var listas []Credencial
	for _, c := range nuevos {
		if c.Email == "" || c.Password == "" {
			continue
		}
		listas = append(listas, c)
	}
	if len(listas) == 0 {
		return 0, 0, nil
	}

	for _, c := range listas {
		// Si el destinatario es la casilla de copia, no recibe dos
		// correos: el resumen de abajo ya trae sus propias credenciales.
		if copia != "" && strings.EqualFold(c.Email, copia) {
			continue
		}
		if err := m.Enviar([]string{c.Email}, "Praxis CRM - tu contraseña de acceso", m.cuerpoCredencial(c)); err != nil {
			fallidos++
			errs = append(errs, fmt.Sprintf("%s: %v", c.Email, err))
			continue
		}
		enviados++
	}

	if copia != "" {
		if err := m.Enviar([]string{copia}, fmt.Sprintf("Praxis CRM - %d credenciales nuevas", len(listas)), m.cuerpoResumen(listas)); err != nil {
			fallidos++
			errs = append(errs, fmt.Sprintf("copia %s: %v", copia, err))
		} else {
			enviados++
		}
	}
	return enviados, fallidos, errs
}

// ============================================================
// Mensaje
// ============================================================

// mensaje arma el correo completo (cabeceras + cuerpo) en CRLF, que es lo
// que exige el protocolo SMTP. El asunto se codifica en QEncoding porque
// trae acentos y el header SMTP es ASCII.
func (m *Mailer) mensaje(destinos []string, asunto, cuerpo string) []byte {
	var b strings.Builder
	fmt.Fprintf(&b, "From: %s\r\n", m.remitente())
	fmt.Fprintf(&b, "To: %s\r\n", strings.Join(destinos, ", "))
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
// Cuerpos de correo
// ============================================================

func (m *Mailer) cuerpoCredencial(c Credencial) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Hola %s:\n", nombreOMensaje(c))
	b.WriteString("\n")
	b.WriteString("Se creó tu usuario en Praxis CRM con estos datos:\n")
	b.WriteString("\n")
	fmt.Fprintf(&b, "  Rol:         %s\n", rolOMensaje(c))
	fmt.Fprintf(&b, "  Correo:      %s\n", c.Email)
	fmt.Fprintf(&b, "  Contraseña:  %s\n", c.Password)
	if m.AppURL != "" {
		fmt.Fprintf(&b, "  Ingresa en:  %s\n", m.AppURL)
	}
	b.WriteString("\n")
	b.WriteString("Entrá con ese correo y esa contraseña. Desde tu perfil podés\n")
	b.WriteString("cambiarla cuando quieras.\n")
	b.WriteString("\n")
	b.WriteString("-- \nLaboratorio Praxis\nMensaje automático generado por la carga inicial del ETL.\n")
	return b.String()
}

func (m *Mailer) cuerpoResumen(listas []Credencial) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Credenciales creadas en la última carga del ETL (%s):\n",
		time.Now().Format("02/01/2006 15:04"))
	b.WriteString("\n")
	for i, c := range listas {
		fmt.Fprintf(&b, "%d. %s\n", i+1, nombreOMensaje(c))
		fmt.Fprintf(&b, "   Rol:        %s\n", rolOMensaje(c))
		fmt.Fprintf(&b, "   Correo:     %s\n", c.Email)
		fmt.Fprintf(&b, "   Contraseña: %s\n\n", c.Password)
	}
	if m.AppURL != "" {
		fmt.Fprintf(&b, "Ingreso: %s\n\n", m.AppURL)
	}
	b.WriteString("-- \nLaboratorio Praxis\nMensaje automático generado por la carga inicial del ETL.\n")
	return b.String()
}

func nombreOMensaje(c Credencial) string {
	if n := strings.TrimSpace(c.Nombre); n != "" {
		return n
	}
	return "(sin nombre)"
}

func rolOMensaje(c Credencial) string {
	if c.Rol == "" {
		return "usuario"
	}
	return c.Rol
}

// ============================================================
// Entrega
// ============================================================

// entregar hace el diálogo SMTP completo con reintentos: un corte del
// servidor no se lleva puesto el correo de esa cuenta.
func (m *Mailer) entregar(destinos []string, msg []byte) error {
	var err error
	for intento := 0; intento < intentos; intento++ {
		if intento > 0 {
			time.Sleep(esperaReintento * time.Duration(intento))
		}
		if err = m.entregarUnaVez(destinos, msg); err == nil {
			return nil
		}
	}
	return fmt.Errorf("tras %d intentos: %w", intentos, err)
}

// entregarUnaVez abre y cierra una conexión por correo: las corridas mandan
// muy pocos y así un fallo no arrastra a los demás.
func (m *Mailer) entregarUnaVez(destinos []string, msg []byte) error {
	if m.enviarFunc != nil {
		return m.enviarFunc(destinos, msg)
	}

	addr := net.JoinHostPort(m.Host, strconv.Itoa(m.Port))

	conn, err := m.conectar(addr)
	if err != nil {
		return err
	}
	defer conn.Close()
	// Sin deadline la corrida se colgaría si el servidor deja el socket abierto.
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
	for _, d := range destinos {
		if err := c.Rcpt(d); err != nil {
			return fmt.Errorf("RCPT TO %s: %w", d, err)
		}
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
