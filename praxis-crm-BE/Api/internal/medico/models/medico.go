package models

import (
	"encoding/json"
	"time"
)

type Medico struct {
	PersonaID          int             `json:"persona_id"`
	Codigo             *string         `json:"codigo,omitempty"`
	Matricula          string          `json:"matricula"`
	EspecialidadID     int             `json:"especialidad_id"`
	VisitadorID        *int            `json:"visitador_id,omitempty"`
	EsParticular       bool            `json:"es_particular"`
	Direccion          json.RawMessage `json:"direccion"`
	Clasificacion      int             `json:"clasificacion"`
	FrecuenciaVisita   string          `json:"frecuencia_visita"`
	Notas              json.RawMessage `json:"notas"`
	Status             bool            `json:"status"`
	CreadoPor          *int            `json:"creado_por,omitempty"`
	ModificadoPor      *int            `json:"modificado_por,omitempty"`
	FechaCreacion      time.Time       `json:"fecha_creacion"`
	UltimaModificacion time.Time       `json:"ultima_modificacion"`
}

// PersonaInput son los datos de la persona base del médico. Se usa cuando el
// alta se hace en un solo paso: el backend inserta persona + medico dentro de
// la misma transacción, así que si algo falla no queda la persona huérfana.
type PersonaInput struct {
	Nombre          string  `json:"nombre"`
	PrimerApellido  string  `json:"primer_apellido"`
	SegundoApellido *string `json:"segundo_apellido,omitempty"`
	Sexo            string  `json:"sexo"`
	Correo          string  `json:"correo"`
	Telefono        string  `json:"telefono"`
	CI              string  `json:"ci"`
	Nacimiento      *string `json:"nacimiento,omitempty"`
	CiudadID        *int    `json:"ciudad_id,omitempty"`
}

type CreateMedicoRequest struct {
	// PersonaID referencia una persona ya existente. Se ignora si viene Persona.
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
	// Persona, si viene, se inserta en la misma transacción que el médico.
	Persona *PersonaInput `json:"persona,omitempty"`
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
