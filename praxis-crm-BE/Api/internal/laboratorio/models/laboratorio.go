package models

import (
	"encoding/json"
	"time"
)

type Laboratorio struct {
	ID            int             `json:"id"`
	Nombre        string          `json:"nombre"`
	Area          string          `json:"area"`
	Precio        float64         `json:"precio"`
	ComisionExtra float64         `json:"comision_extra"`
	Status        bool            `json:"status"`
	CostosCiudad  json.RawMessage `json:"costos_ciudad,omitempty"`
	CreadoPor     *int            `json:"creado_por,omitempty"`
	ModificadoPor *int            `json:"modificado_por,omitempty"`
	FechaCreacion time.Time       `json:"fecha_creacion"`
	UltimaModificacion time.Time  `json:"ultima_modificacion"`
}

// LaboratorioPrecio es la unidad que consume la cotización del visitador:
// costo aplicable (costo de la ciudad si existe, sino 0; sin ciudad, el precio
// base del laboratorio) y el recargo por comisión si el destino es particular.
type LaboratorioPrecio struct {
	ID            int     `json:"id"`
	Nombre        string  `json:"nombre"`
	Area          string  `json:"area"`
	Costo         float64 `json:"costo"`
	ComisionExtra float64 `json:"comision_extra"`
}

type CreateLaboratorioRequest struct {
	Nombre        string  `json:"nombre"`
	Area          string  `json:"area"`
	Precio        float64 `json:"precio"`
	ComisionExtra float64 `json:"comision_extra,omitempty"`
}

type UpdateLaboratorioRequest struct {
	Nombre        *string  `json:"nombre,omitempty"`
	Area          *string  `json:"area,omitempty"`
	Precio        *float64 `json:"precio,omitempty"`
	ComisionExtra *float64 `json:"comision_extra,omitempty"`
	Status        *bool    `json:"status,omitempty"`
}