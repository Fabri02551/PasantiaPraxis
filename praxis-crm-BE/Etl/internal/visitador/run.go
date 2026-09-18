package visitador

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ResultadoRun agrupa lo ocurrido en una corrida del ETL de visitadores.
type ResultadoRun struct {
	Fuente        string
	Departamentos []string
	Resultados    []Result
}

// Run ejecuta extracción, transformación y carga de visitadores.
func Run(ctx context.Context, pool *pgxpool.Pool, path string) (ResultadoRun, error) {
	vis, err := Extract(path)
	if err != nil {
		return ResultadoRun{}, err
	}

	loader := NewLoader(pool)
	ciudadIDs, err := loader.SeedDepartamentos(ctx)
	if err != nil {
		return ResultadoRun{}, fmt.Errorf("departamentos: %w", err)
	}

	// Limpiar visitadores existentes antes de recargar
	if err := loader.DeleteVisitadores(ctx); err != nil {
		return ResultadoRun{}, fmt.Errorf("limpiando visitadores: %w", err)
	}

	results, err := loader.Load(ctx, vis, ciudadIDs)
	if err != nil {
		return ResultadoRun{}, fmt.Errorf("carga visitadores: %w", err)
	}

	return ResultadoRun{
		Fuente:        path,
		Departamentos: Departamentos,
		Resultados:    results,
	}, nil
}

// Resumen cuenta los resultados por estado.
func Resumen(res []Result) string {
	var insertados, omitidos, errores int
	for _, r := range res {
		switch r.Estado {
		case "insertado":
			insertados++
		case "omitido":
			omitidos++
		case "error":
			errores++
		}
	}
	var sb strings.Builder
	fmt.Fprintf(&sb, "total=%d insertados=%d omitidos=%d errores=%d",
		len(res), insertados, omitidos, errores)
	return sb.String()
}
