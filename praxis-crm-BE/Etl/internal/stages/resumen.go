package stages

import "fmt"

// Resumen cuenta lo que hizo una etapa.
type Resumen struct {
	Etapa        string
	Insertados   int
	Actualizados int
	Omitidos     int
	Errores      int
	Detalle      []string
}

func (r Resumen) String() string {
	return fmt.Sprintf("insertados=%d actualizados=%d omitidos=%d errores=%d",
		r.Insertados, r.Actualizados, r.Omitidos, r.Errores)
}

// TotalFilas es el número de filas leídas de la cartera, para contrastar
// con lo que realmente entró a la base.
func (r Resumen) TotalFilas() int {
	return r.Insertados + r.Actualizados + r.Omitidos + r.Errores
}
