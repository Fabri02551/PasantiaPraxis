package pipeline

import (
	"fmt"
	"strings"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/admin"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/config"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/mailer"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/visitador"
)

// ResumenCorreo resume el envío de credenciales de la corrida. Nunca
// interrumpe el ETL: un correo que no sale queda registrado en el log y las
// contraseñas siguen disponibles en logs/visitadores_*.log.
type ResumenCorreo struct {
	Enviados int
	Fallidos int
	// Individuales cuenta los correos que fueron a la casilla del propio
	// usuario; Resumen los que fueron a la casilla admin con todas las
	// credenciales. Se registran aparte para que en el log se vea que cada
	// visitador recibe el suyo y no solo una copia para el administrador.
	Individuales int
	Resumen      int
	Errores      []string
	Pendientes   int
	SinSMTP      bool
}

func (r ResumenCorreo) String() string {
	switch {
	case r.SinSMTP:
		return fmt.Sprintf("no enviado: SMTP_HOST sin configurado (%d credenciales solo en logs/)", r.Pendientes)
	case r.Enviados == 0 && r.Fallidos == 0:
		return "sin credenciales nuevas"
	default:
		s := fmt.Sprintf("enviados=%d fallidos=%d", r.Enviados, r.Fallidos)
		if r.Individuales > 0 || r.Resumen > 0 {
			s += fmt.Sprintf(" | a su correo: %d | resumen para el admin: %d", r.Individuales, r.Resumen)
		}
		if len(r.Errores) > 0 {
			s += " | " + strings.Join(r.Errores, "; ")
		}
		return s
	}
}

// enviarCredenciales junta las contraseñas generadas en esta corrida (la del
// admin recién creado y las de los visitadores insertados) y las manda por
// correo: cada cuenta recibe la suya en su propia casilla y cfg.AdminEmail
// recibe además el resumen con todas.
func enviarCredenciales(cfg config.Config, adm admin.Resultado, nuevos []visitador.Result) ResumenCorreo {
	var creds []mailer.Credencial

	if adm.Estado == "creado" && adm.Password != "" {
		creds = append(creds, mailer.Credencial{
			Nombre:   admin.NombreCompleto,
			Email:    adm.Email,
			Password: adm.Password,
			Rol:      "admin",
		})
	}
	for _, r := range nuevos {
		// Solo los insertados de esta corrida: a los que ya existían no
		// se les regeneró contraseña, así que no hay nada que mandar.
		if r.Estado != "insertado" || r.Password == "" {
			continue
		}
		creds = append(creds, mailer.Credencial{
			Nombre:   strings.TrimSpace(r.Nombre + " " + r.PrimerApellido + " " + r.SegundoApellido),
			Email:    r.Email,
			Password: r.Password,
			Rol:      "visitador",
		})
	}

	if len(creds) == 0 {
		return ResumenCorreo{}
	}

	// Cuántos van a la casilla propia y cuántos al resumen del admin,
	// antes de mandar: es lo que después se registra en el log.
	res := ResumenCorreo{}
	for _, c := range creds {
		if cfg.AdminEmail != "" && strings.EqualFold(c.Email, cfg.AdminEmail) {
			continue
		}
		res.Individuales++
	}
	if cfg.AdminEmail != "" && len(creds) > 0 {
		res.Resumen = 1
	}

	m := mailer.New(cfg)
	if !m.Habilitado() {
		res.SinSMTP = true
		res.Pendientes = len(creds)
		return res
	}

	enviados, fallidos, errs := m.NotificarNuevos(creds, cfg.AdminEmail)
	res.Enviados = enviados
	res.Fallidos = fallidos
	res.Errores = errs
	return res
}
