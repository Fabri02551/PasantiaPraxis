package email

import (
	"bytes"
	"crypto/tls"
	"errors"
	"fmt"
	"net/smtp"
	"strconv"
	"strings"
	"text/template"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/config"
)

type Service struct {
	cfg config.Config
}

func New(cfg config.Config) *Service {
	return &Service{cfg: cfg}
}

type SendResetPasswordInput struct {
	To        string
	Token     string
	AppURL    string
	ExpiresIn string
}

func (s *Service) SendResetPassword(input SendResetPasswordInput) error {
	if s.cfg.SMTPUsername == "" || s.cfg.SMTPPassword == "" || s.cfg.SMTPFrom == "" {
		return errors.New("smtp no configurado")
	}

	subject := "Restablecer contraseña - Laboratorio Praxis"
	body, err := buildResetTemplate(input)
	if err != nil {
		return err
	}

	auth := smtp.PlainAuth("", s.cfg.SMTPUsername, s.cfg.SMTPPassword, s.cfg.SMTPHost)
	addr := fmt.Sprintf("%s:%s", s.cfg.SMTPHost, s.cfg.SMTPPort)
	port, _ := strconv.Atoi(s.cfg.SMTPPort)

	if strings.ToLower(s.cfg.SMTPEncryption) == "tls" || port == 465 {
		tlsConfig := &tls.Config{ServerName: s.cfg.SMTPHost}
		conn, err := tls.Dial("tcp", addr, tlsConfig)
		if err != nil {
			return err
		}
		c, err := smtp.NewClient(conn, s.cfg.SMTPHost)
		if err != nil {
			return err
		}
		defer c.Close()
		if err := c.Auth(auth); err != nil {
			return err
		}
		if err := c.Mail(s.cfg.SMTPFrom); err != nil {
			return err
		}
		if err := c.Rcpt(input.To); err != nil {
			return err
		}
		wc, err := c.Data()
		if err != nil {
			return err
		}
		_, _ = wc.Write(buildMessage(s.cfg.SMTPFrom, s.cfg.SMTPFromName, input.To, subject, body))
		_ = wc.Close()
		return c.Quit()
	}

	return smtp.SendMail(addr, auth, s.cfg.SMTPFrom, []string{input.To}, buildMessage(s.cfg.SMTPFrom, s.cfg.SMTPFromName, input.To, subject, body))
}

func buildMessage(from, fromName, to, subject, body string) []byte {
	fromStr := from
	if fromName != "" {
		fromStr = fmt.Sprintf("%s <%s>", fromName, from)
	}
	var buf bytes.Buffer
	buf.WriteString(fmt.Sprintf("From: %s\r\n", fromStr))
	buf.WriteString(fmt.Sprintf("To: %s\r\n", to))
	buf.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	buf.WriteString("MIME-Version: 1.0\r\n")
	buf.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	buf.WriteString("\r\n")
	buf.WriteString(body)
	return buf.Bytes()
}

func buildResetTemplate(input SendResetPasswordInput) (string, error) {
	tmpl := `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
<p>Hola,</p>
<p>Has solicitado restablecer tu contraseña.</p>
<p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
<p><a href="{{.Link}}">Restablecer contraseña</a></p>
<p>Este enlace expirará en {{.ExpiresIn}}.</p>
<p>Si no solicitaste este cambio, ignora este mensaje.</p>
<p>Saludos,<br/>Laboratorio Praxis</p>
</body></html>`
	t := template.Must(template.New("reset").Parse(tmpl))
	var out bytes.Buffer
	link := strings.TrimRight(input.AppURL, "/") + "/reset-password?token=" + input.Token
	_ = t.Execute(&out, map[string]string{"Link": link, "ExpiresIn": input.ExpiresIn})
	return out.String(), nil
}
