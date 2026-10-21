package pipeline

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/admin"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/stages"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/visitador"
)

// ResumenRun es lo que queda registrado en logs/etl_<fecha>.log: las seis
// etapas, sus errores y los tiempos de la corrida. Se va llenando mientras
// Pipeline.Run avanza y se escribe al final, incluso si una etapa aborta.
type ResumenRun struct {
	Inicio time.Time
	Fin    time.Time
	Error  error

	Fuentes      []string
	Ciudad       stages.Resumen
	Especialidad stages.Resumen
	Visitador    visitador.ResultadoRun
	Medico       stages.Resumen
	Institucion  stages.Resumen
	Laboratorio  stages.Resumen

	// Admin es la cuenta administradora que la corrida siembra, y Correo
	// cómo salió el envío de las credenciales nuevas.
	Admin  admin.Resultado
	Correo ResumenCorreo
	// LogAdmin es la ruta del archivo con la contraseña del admin cuando
	// la creó esta corrida (respaldo por si el correo no llega).
	LogAdmin string

	// LogVisitadores es la ruta del archivo donde se escribieron las
	// contraseñas de los visitadores insertados en esta corrida.
	LogVisitadores string
}

// escribirLog escribe logs/etl_<año><mes><dia>_<hora>.log con el resumen de
// la corrida. El archivo se genera aunque la corrida haya fallado, para no
// perder el rastro del error.
func (r ResumenRun) escribirLog(logDir string) error {
	if err := os.MkdirAll(logDir, 0o755); err != nil {
		return err
	}
	path := filepath.Join(logDir, fmt.Sprintf("etl_%s.log", time.Now().Format("20060102_150405")))

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	ts := r.Fin.Format("2006-01-02 15:04:05")
	w := func(format string, a ...any) {
		fmt.Fprintf(f, "[%s] %s\n", ts, fmt.Sprintf(format, a...))
	}

	w("=============================== ETL ===============================")
	w("Inicio: %s", r.Inicio.Format("2006-01-02 15:04:05"))
	w("Fuentes:")
	for i, fuente := range r.Fuentes {
		w("  %d. %s", i+1, fuente)
	}
	w("------------------------------------------------------------------")
	w("[ciudad]       %s", r.Ciudad)
	w("[especialidad] %s", r.Especialidad)
	w("[visitador]    %s", visitador.Resumen(r.Visitador.Resultados))
	w("[medico]       %s", r.Medico)
	w("[institucion]  %s", r.Institucion)
	w("[laboratorio]  %s", r.Laboratorio)
	w("[admin]        %s", r.Admin)
	w("[correo]       %s", r.Correo)
	w("------------------------------------------------------------------")
	errores := r.coleccionErrores()
	w("Errores de la corrida (%d):", len(errores))
	for _, e := range errores {
		w("  %s", e)
	}
	w("------------------------------------------------------------------")
	w("Visitadores indexados para las carteras: %d", len(r.Visitador.Resultados))
	w("Tablas que el ETL no toca: %s", strings.Join(TablasQueNoSeCargan, ", "))
	w("clasificacion de instituciones: la sube el usuario a mano desde revisar_clasificacion.csv")
	if r.LogVisitadores != "" {
		w("Credenciales de visitadores nuevos: %s", r.LogVisitadores)
	}
	if r.LogAdmin != "" {
		w("Credencial del admin nuevo: %s", r.LogAdmin)
	}
	w("Fin: %s", r.Fin.Format("2006-01-02 15:04:05"))
	w("Duracion: %s", r.Fin.Sub(r.Inicio).Round(time.Millisecond))
	w("==================================================================")
	return nil
}

// coleccionErrores junta todos los errores registrados por las etapas: los
// Detalle de cada resumen y los visitadores que quedaron en error/omitido.
func (r ResumenRun) coleccionErrores() []string {
	var out []string
	armar := func(etapa string, res stages.Resumen) {
		if res.Errores > 0 {
			for _, det := range res.Detalle {
				out = append(out, fmt.Sprintf("[%s] %s", etapa, det))
			}
		}
	}
	armar("ciudad", r.Ciudad)
	armar("especialidad", r.Especialidad)
	armar("medico", r.Medico)
	armar("institucion", r.Institucion)
	armar("laboratorio", r.Laboratorio)
	for _, v := range r.Visitador.Resultados {
		if v.Estado == "error" || v.Estado == "omitido" {
			out = append(out, fmt.Sprintf("[visitador] %s: %s", v.Nombre, v.Detalle))
		}
	}
	for _, e := range r.Correo.Errores {
		out = append(out, "[correo] "+e)
	}
	if r.Error != nil {
		out = append(out, "[etl] "+r.Error.Error())
	}
	return out
}
