package pipeline

import (
	"strings"
	"testing"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/admin"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/config"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/visitador"
)

// Sin SMTP no se manda nada, pero el resumen deja ver cuántas credenciales
// quedaron solo en logs/ y a cuántos usuarios les tocaba correo propio.
func TestEnviarCredencialesSinSMTP(t *testing.T) {
	cfg := config.Config{AdminEmail: "admin@x.com"}
	res := enviarCredenciales(cfg,
		admin.Resultado{Estado: "creado", Email: "admin@x.com", Password: "x"},
		[]visitador.Result{
			{Estado: "insertado", Email: "ana@x.com", Password: "p1"},
			{Estado: "insertado", Email: "bruno@x.com", Password: "p2"},
			{Estado: "actualizado", Email: "carla@x.com"},
			{Estado: "omitido", Email: ""},
		},
	)

	if !res.SinSMTP {
		t.Error("sin SMTP_HOST se espera SinSMTP")
	}
	if res.Pendientes != 3 {
		t.Errorf("pendientes: se esperan 3 (admin + 2 visitadores), llegó %d", res.Pendientes)
	}
	if res.Individuales != 2 {
		t.Errorf("individuales: se esperan 2 (los visitadores), llegó %d", res.Individuales)
	}
	if !strings.Contains(res.String(), "SMTP_HOST sin configurado") {
		t.Errorf("el resumen debería avisar que no hay SMTP: %q", res.String())
	}
}

// El log tiene que distinguir los correos que van a la casilla de cada
// usuario del resumen que recibe la casilla admin: es lo que hace visible
// que cada visitador recibe el suyo.
func TestResumenCorreoStringDistingueDestinos(t *testing.T) {
	res := ResumenCorreo{Enviados: 3, Fallidos: 0, Individuales: 2, Resumen: 1}
	s := res.String()

	if !strings.Contains(s, "a su correo: 2") {
		t.Errorf("faltan los envíos individuales: %q", s)
	}
	if !strings.Contains(s, "resumen para el admin: 1") {
		t.Errorf("falta el resumen para el admin: %q", s)
	}
}

func TestResumenCorreoSinCredenciales(t *testing.T) {
	if s := (ResumenCorreo{}).String(); s != "sin credenciales nuevas" {
		t.Errorf("sin credenciales: se espera %q, llegó %q", "sin credenciales nuevas", s)
	}
}
