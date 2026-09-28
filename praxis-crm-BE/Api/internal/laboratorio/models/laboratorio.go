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