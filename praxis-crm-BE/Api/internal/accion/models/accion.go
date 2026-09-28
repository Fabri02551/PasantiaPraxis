package models

import (
	"encoding/json"
	"time"
)

type Accion struct {
	ID               int             `json:"id"`
	NombreAccion     string          `json:"nombre_accion"`
	Ciudad           json.RawMessage `json:"ciudad"`
	Detalle          string          `json:"detalle"`
	ImpactoEsperado  string          `json:"impacto_esperado"`
	Prioridad        int             `json:"prioridad"`
	Status           bool            `json:"status"`
	CreatedAt        time.Time       `json:"created_at,omitempty"`
}

type CreateAccionRequest struct {
	NombreAccion    string          `json:"nombre_accion"`
	Ciudad          json.RawMessage `json:"ciudad,omitempty"`
	Detalle         string          `json:"detalle"`
	ImpactoEsperado string          `json:"impacto_esperado"`
	Prioridad       int             `json:"prioridad"`
}

type UpdateAccionRequest struct {
	NombreAccion    string          `json:"nombre_accion"`
	Ciudad          json.RawMessage `json:"ciudad,omitempty"`
	Detalle         string          `json:"detalle"`
	ImpactoEsperado string          `json:"impacto_esperado"`
	Prioridad       int             `json:"prioridad"`
	Status          *bool           `json:"status"`
}