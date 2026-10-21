// Comando reenvio: manda una credencial que quedó sin correo en la última
// corrida (por ejemplo porque el SMTP cortó la conexión). Existe para
// recuperar un envío puntual sin resetear la contraseña del usuario.
package main

import (
	"flag"
	"fmt"
	"os"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/config"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/mailer"
)

func main() {
	email := flag.String("email", "", "correo del destinatario")
	password := flag.String("password", "", "contraseña que se manda")
	nombre := flag.String("nombre", "", "nombre que se saluda en el correo")
	rol := flag.String("rol", "visitador", "rol que se muestra en el correo")
	flag.Parse()

	if *email == "" || *password == "" {
		fmt.Fprintln(os.Stderr, "faltan -email y -password")
		os.Exit(2)
	}

	m := mailer.New(config.Load())
	if !m.Habilitado() {
		fmt.Fprintln(os.Stderr, "SMTP_HOST sin configurado: no hay a dónde enviar")
		os.Exit(1)
	}

	enviados, fallidos, errs := m.NotificarNuevos([]mailer.Credencial{
		{Nombre: *nombre, Email: *email, Password: *password, Rol: *rol},
	}, "")
	for _, e := range errs {
		fmt.Fprintln(os.Stderr, "error:", e)
	}
	fmt.Printf("enviados=%d fallidos=%d\n", enviados, fallidos)
	if fallidos > 0 {
		os.Exit(1)
	}
}
