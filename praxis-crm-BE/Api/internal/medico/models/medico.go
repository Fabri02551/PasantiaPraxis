package models

import (
	"encoding/json"
	"time"
)

type Medico struct {
	PersonaID        int             `json:"persona_id"`
	Codigo           *string         `json:"codigo,omitempty"`
	Matricula        string          `json:"matricula"`
	EspecialidadID   int             `json:"especialidad_id"`
	VisitadorID      *int            `json:"visitador_id,omitempty"`
	EsParticular     bool            `json:"es_particular"`
	Direccion        json.RawMessage `json:"direccion"`
	Clasificacion    int             `json:"clasificacion"`
	FrecuenciaVisita string          `json:"frecuencia_visita"`
	Notas            json.RawMessage `json:"notas"`
	Status           bool            `json:"status"`
	CreadoPor        *int            `json:"creado_por,omitempty"`
	ModificadoPor    *int            `json:"modificado_por,omitempty"`
	FechaCreacion    time.Time       `json:"fecha_creacion"`
	UltimaModificacion time.Time     `json:"ultima_modificacion"`
}

type CreateMedicoRequest struct {
	PersonaID        int             `json:"persona_id"`
	Codigo           *string         `json:"codigo,omitempty"`
	Matricula        string          `json:"matricula"`
	EspecialidadID   int             `json:"especialidad_id"`
	VisitadorID      *int            `json:"visitador_id,omitempty"`
	EsParticular     bool            `json:"es_particular"`
	Direccion        json.RawMessage `json:"direccion,omitempty"`
	Clasificacion    int             `json:"clasificacion"`
	FrecuenciaVisita string          `json:"frecuencia_visita"`
	Notas            json.RawMessage `json:"notas,omitempty"`
}

type UpdateMedicoRequest struct {
	Codigo           *string         `json:"codigo,omitempty"`
	Matricula        *string         `json:"matricula,omitempty"`
	EspecialidadID   *int            `json:"especialidad_id,omitempty"`
	VisitadorID      *int            `json:"visitador_id,omitempty"`
	EsParticular     *bool           `json:"es_particular"`
	Direccion        json.RawMessage `json:"direccion,omitempty"`
	Clasificacion    *int            `json:"clasificacion"`
	FrecuenciaVisita string          `json:"frecuencia_visita"`
	Notas            json.RawMessage `json:"notas,omitempty"`
	Status           *bool           `json:"status"`
}