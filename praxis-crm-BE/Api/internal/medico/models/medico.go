package models

import (
	"encoding/json"
	"time"
)

type Medico struct {
	PersonaID       int             `json:"persona_id"`
	Codigo          string          `json:"codigo"`
	EspecialidadID  *int            `json:"especialidad_id,omitempty"`
	Institucion     string          `json:"institucion"`
	Direccion       json.RawMessage `json:"direccion"`
	Clasificacion   int             `json:"clasificacion"`
	FrecuenciaVisita string          `json:"frecuencia_visita"`
	Notas           json.RawMessage `json:"notas"`
	Status          bool            `json:"status"`
	CreatedAt       time.Time       `json:"created_at,omitempty"`
}

type CreateMedicoRequest struct {
	PersonaID       int              `json:"persona_id"`
	Codigo          string           `json:"codigo"`
	EspecialidadID  *int             `json:"especialidad_id,omitempty"`
	Institucion     string           `json:"institucion"`
	Direccion       json.RawMessage  `json:"direccion,omitempty"`
	Clasificacion   int              `json:"clasificacion"`
	FrecuenciaVisita string          `json:"frecuencia_visita"`
	Notas           json.RawMessage  `json:"notas,omitempty"`
}

type UpdateMedicoRequest struct {
	Codigo          string           `json:"codigo"`
	EspecialidadID  *int             `json:"especialidad_id,omitempty"`
	Institucion     string           `json:"institucion"`
	Direccion       json.RawMessage  `json:"direccion,omitempty"`
	Clasificacion   int              `json:"clasificacion"`
	FrecuenciaVisita string          `json:"frecuencia_visita"`
	Notas           json.RawMessage  `json:"notas,omitempty"`
	Status          *bool            `json:"status"`
}