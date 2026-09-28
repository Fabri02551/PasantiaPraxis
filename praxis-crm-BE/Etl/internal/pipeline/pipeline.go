package pipeline

import (
	"context"
	"fmt"
	"log"
	"path/filepath"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/config"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/stages"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/visitador"
)

// TablasQueNoSeCargan documenta, para quien lea la corrida, que el ETL
// deja estas tablas fuera a propósito.
//
//	visita            -> se registra desde la app cuando el visitador
//	                    visita al médico o institución. Depende de datos que
//	                    solo existen en campo (firma, latitud, duración).
//	visita_laboratorio -> intersección de una visita con los estudios que
//	                    se le orderingne. Sin visita no se puede calcular el
//	                    costo, que depende del precio en la ciudad del
//	                    médico y de la comisión si es particular.
//
// Se cargarán más adelante, cuando haya visitas reales.
var TablasQueNoSeCargan = []string{"visita", "visita_laboratorio"}

// Pipeline encadena las etapas en el orden que exigen las claves foráneas.
type Pipeline struct {
	cfg  config.Config
	pool *pgxpool.Pool
}

func New(cfg config.Config, pool *pgxpool.Pool) Pipeline {
	return Pipeline{cfg: cfg, pool: pool}
}

// Run ejecuta todas las etapas en orden.
//
// El orden no es arbitrario, sale del grafo de claves foráneas:
//
//  1. ciudad        -> persona.ciudad_id, institucion.ciudad_id,
//     laboratorio_ciudad.ciudad_id
//  2. especialidad  -> medico.especialidad_id (NOT NULL)
//  3. visitador     -> medico.visitador_id, institucion.visitador_id
//  4. medico        -> persona + medico
//  5. institucion   -> persona + institucion
//  6. laboratorio   -> laboratorio + laboratorio_ciudad
//
// Ciudad y especialidad no dependen de nada. Visitador va antes que médico
// porque cada fila de la cartera trae su visitador asignado y esa columna
// se resuelve contra los visitadores ya cargados; al revés, los médicos
// quedarían con visitador_id NULL.
func (p Pipeline) Run(ctx context.Context) error {
	inicio := time.Now()
	logDir := filepath.Join(p.cfg.SrcDir, "..", "logs")
	run := &ResumenRun{Inicio: inicio}
	// El log de la corrida se escribe siempre: si una etapa aborta, la
	// corrida quedó igualmente registrada con su error.
	defer func() {
		run.Fin = time.Now()
		if err := run.escribirLog(logDir); err != nil {
			log.Printf("[etl] no se pudo escribir el log de corrida: %v", err)
		}
	}()

	log.Printf("=== inicio de la corrida del ETL ===")

	src := func(partes ...string) string {
		pth := filepath.Join(append([]string{p.cfg.SrcDir}, partes...)...)
		run.Fuentes = append(run.Fuentes, pth)
		return pth
	}

	// 1. ciudad
	ciudades, resCiudad, err := stages.EtapaCiudad(ctx, p.pool, src("ciudad", "ciudades.csv"))
	if err != nil {
		run.Error = fmt.Errorf("etapa ciudad: %w", err)
		return run.Error
	}
	run.Ciudad = resCiudad

	// 2. especialidad
	especialidades, resEspecialidad, err := stages.EtapaEspecialidad(ctx, p.pool, src("especialidad", "especialidades.csv"))
	if err != nil {
		run.Error = fmt.Errorf("etapa especialidad: %w", err)
		return run.Error
	}
	run.Especialidad = resEspecialidad

	// 3. visitador
	vis, err := visitador.Run(ctx, p.pool, src("vistadores", "visitadores.csv"), ciudades)
	if err != nil {
		run.Error = fmt.Errorf("etapa visitador: %w", err)
		return run.Error
	}
	run.Visitador = vis
	// Las contraseñas de los insertados se escriben a logs/ para no
	// perderlas: el pipeline no imprime credenciales por consola.
	logVisitadores, err := visitador.GuardarLog(vis, logDir)
	if err != nil {
		log.Printf("[visitador] no se pudo escribir el log: %v", err)
	} else {
		run.LogVisitadores = logVisitadores
	}
	log.Printf("[visitador] %s", visitador.Resumen(vis.Resultados))
	for _, r := range vis.Resultados {
		if r.Estado == "error" || r.Estado == "omitido" {
			log.Printf("[visitador] %s %s: %s", r.Estado, r.Nombre, r.Detalle)
		}
	}
	log.Printf("[visitador] %d nombres indexados para las carteras", vis.Mapa.TotalAliases())

	// 4. medico
	run.Medico, err = stages.EtapaMedico(ctx, p.pool, src("medicos", "medicos_carteras.csv"),
		ciudades, especialidades, vis.Mapa)
	if err != nil {
		run.Error = fmt.Errorf("etapa medico: %w", err)
		return run.Error
	}

	// 5. institucion
	run.Institucion, err = stages.EtapaInstitucion(ctx, p.pool, src("instituciones", "instituciones_carteras.csv"),
		ciudades, vis.Mapa)
	if err != nil {
		run.Error = fmt.Errorf("etapa institucion: %w", err)
		return run.Error
	}

	// 6. laboratorio
	run.Laboratorio, err = stages.EtapaLaboratorio(ctx, p.pool, src("laboratorios", "precios_base_por_departamento.csv"),
		ciudades)
	if err != nil {
		run.Error = fmt.Errorf("etapa laboratorio: %w", err)
		return run.Error
	}

	log.Printf("=== resumen ===")
	log.Printf("  medico:      %s", run.Medico)
	log.Printf("  institucion: %s", run.Institucion)
	log.Printf("  laboratorio: %s", run.Laboratorio)
	log.Printf("  visitador:   %s", visitador.Resumen(vis.Resultados))
	log.Printf("  no se cargan: %v", TablasQueNoSeCargan)
	log.Printf("  clasificacion de instituciones: la sube el usuario a mano desde revisar_clasificacion.csv")
	log.Printf("=== corrida terminada en %s ===", time.Since(inicio).Round(time.Millisecond))
	return nil
}