package models

import "time"

type Especialidad struct {
	ID        int       `json:"id"`
	Nombre    string    `json:"nombre"`
	Codigo    string    `json:"codigo"`
	Status    bool      `json:"status"`
	CreatedAt time.Time `json:"created_at,omitempty"`
}

type CreateEspecialidadRequest struct {
	Nombre string `json:"nombre"`
	Codigo string `json:"codigo"`
}

type UpdateEspecialidadRequest struct {
	Nombre string `json:"nombre"`
	Codigo string `json:"codigo"`
	Status *bool  `json:"status"`
}