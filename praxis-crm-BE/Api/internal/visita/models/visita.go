package models

import (
	"encoding/json"
	"time"
)

type Visita struct {
	ID                 int             `json:"id"`
	IDVisitador        int             `json:"id_visitador"`
	IDMedico           int             `json:"id_medico"`
	FechaVisita        time.Time       `json:"fecha_visita"`
	FechaVisitaTentativa *time.Time    `json:"fecha_visita_tentativa,omitempty"`
	Latitud            float64         `json:"latitud,omitempty"`
	Longitud           float64         `json:"longitud,omitempty"`
	Firma              string          `json:"firma"`
	Observacion        json.RawMessage `json:"observacion"`
	Satisfaccion       int             `json:"satisfaccion"`
	Duracion           int             `json:"duracion"`
	Ingreso            string          `json:"ingreso"`
	Papeleta           int             `json:"papeleta"`
}

type CreateVisitaRequest struct {
	IDVisitador          int             `json:"id_visitador"`
	IDMedico             int             `json:"id_medico"`
	FechaVisita          *time.Time      `json:"fecha_visita"`
	FechaVisitaTentativa *time.Time      `json:"fecha_visita_tentativa,omitempty"`
	Latitud              *float64        `json:"latitud,omitempty"`
	Longitud             *float64        `json:"longitud,omitempty"`
	Firma                string          `json:"firma"`
	Observacion          json.RawMessage `json:"observacion,omitempty"`
	Satisfaccion         int             `json:"satisfaccion"`
	Duracion             int             `json:"duracion"`
	Papeleta             int             `json:"papeleta"`
}

type UpdateVisitaRequest struct {
	FechaVisita          *time.Time      `json:"fecha_visita"`
	FechaVisitaTentativa *time.Time      `json:"fecha_visita_tentativa,omitempty"`
	Latitud              *float64        `json:"latitud,omitempty"`
	Longitud             *float64        `json:"longitud,omitempty"`
	Firma                *string         `json:"firma"`
	Observacion          json.RawMessage `json:"observacion,omitempty"`
	Satisfaccion         *int            `json:"satisfaccion"`
	Duracion             *int            `json:"duracion"`
	Papeleta             *int            `json:"papeleta"`
}