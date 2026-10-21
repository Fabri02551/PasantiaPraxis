package visitador

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/catalog"
)

// ResultadoRun agrupa lo ocurrido en una corrida del ETL de visitadores.
type ResultadoRun struct {
	Fuente        string
	Departamentos []string
	Resultados    []Result
	// Mapa resuelve la columna "VISITADOR ASIGNADO" de las carteras. Lo
	// consumen las etapas de médico e institución.
	Mapa *Mapa
}

// Run ejecuta extracción, transformación y carga de visitadores.
// ciudades es el catálogo ya cargado en la base por la etapa de ciudad: la
// persona del visitador necesita su ciudad_id.
func Run(ctx context.Context, pool *pgxpool.Pool, path string, ciudades *catalog.Ciudades) (ResultadoRun, error) {
	vis, err := Extract(path)
	if err != nil {
		return ResultadoRun{}, err
	}

	loader := NewLoader(pool)
	mapa, results, err := loader.Load(ctx, vis, ciudades)
	if err != nil {
		return ResultadoRun{}, fmt.Errorf("carga visitadores: %w", err)
	}

	return ResultadoRun{
		Fuente:        path,
		Departamentos: Departamentos,
		Resultados:    results,
		Mapa:          mapa,
	}, nil
}

// Resumen cuenta los resultados por estado.
func Resumen(res []Result) string {
	var insertados, actualizados, omitidos, errores int
	for _, r := range res {
		switch r.Estado {
		case "insertado":
			insertados++
		case "actualizado":
			actualizados++
		case "omitido":
			omitidos++
		case "error":
			errores++
		}
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "total=%d insertados=%d actualizados=%d omitidos=%d errores=%d",
		len(res), insertados, actualizados, omitidos, errores)
	return sb.String()
}
