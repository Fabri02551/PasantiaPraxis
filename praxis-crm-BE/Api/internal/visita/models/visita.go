package models

import (
	"encoding/json"
	"time"
)

type Visita struct {
	ID                   int             `json:"id"`
	IDVisitador          int             `json:"id_visitador"`
	IDMedico             *int            `json:"id_medico,omitempty"`
	InstitucionID        *int            `json:"institucion_id,omitempty"`
	FechaVisita          *time.Time      `json:"fecha_visita,omitempty"`
	FechaVisitaTentativa *time.Time      `json:"fecha_visita_tentativa,omitempty"`
	Latitud              *float64        `json:"latitud,omitempty"`
	Longitud             *float64        `json:"longitud,omitempty"`
	Firma                string          `json:"firma"`
	Observacion          json.RawMessage `json:"observacion"`
	Satisfaccion         int             `json:"satisfaccion"`
	Duracion             int             `json:"duracion"`
	Ingreso              string          `json:"ingreso"`
	Papeleta             int             `json:"papeleta"`
	Registrada           bool            `json:"registrada"`
	Estado               string          `json:"estado"`
}

// CreateVisitaRequest es lo que llena el admin al programar una visita:
// visitador, médico o institución a visitar y fecha tentativa.
type CreateVisitaRequest struct {
	IDVisitador          int        `json:"id_visitador"`
	IDMedico             *int       `json:"id_medico,omitempty"`
	InstitucionID        *int       `json:"institucion_id,omitempty"`
	FechaVisitaTentativa *time.Time `json:"fecha_visita_tentativa"`
}

type UpdateVisitaRequest struct {
	IDVisitador          *int       `json:"id_visitador,omitempty"`
	IDMedico             *int       `json:"id_medico,omitempty"`
	InstitucionID        *int       `json:"institucion_id,omitempty"`
	FechaVisitaTentativa *time.Time `json:"fecha_visita_tentativa,omitempty"`
}

// RegistrarVisitaRequest es lo que llena el visitador cuando hace la visita
// real: todo excepto la fecha tentativa (que ya se guardó al crear la visita).
type RegistrarVisitaRequest struct {
	FechaVisita  *time.Time      `json:"fecha_visita"`
	Latitud      *float64        `json:"latitud,omitempty"`
	Longitud     *float64        `json:"longitud,omitempty"`
	Firma        string          `json:"firma"`
	Observacion  json.RawMessage `json:"observacion,omitempty"`
	Satisfaccion int             `json:"satisfaccion"`
	Duracion     int             `json:"duracion"`
	Papeleta     int             `json:"papeleta"`
}

type VisitaLaboratorio struct {
	LaboratorioID int     `json:"laboratorio_id"`
	Nombre        string  `json:"nombre"`
	Area          string  `json:"area"`
	Costo         float64 `json:"costo"`
	Cantidad      int     `json:"cantidad"`
}

// AddLaboratorioItem estudio con la cantidad solicitada en la cotización.
type AddLaboratorioItem struct {
	LaboratorioID int `json:"laboratorio_id"`
	Cantidad      int `json:"cantidad"`
}

type AddLaboratoriosRequest struct {
	Laboratorios []AddLaboratorioItem `json:"laboratorios"`
}