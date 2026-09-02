package models

import "time"

type Ciudad struct {
	ID        int       `json:"id"`
	Nombre    string    `json:"nombre"`
	Status    bool      `json:"status"`
	CreatedAt time.Time `json:"created_at,omitempty"`
}

type CreateCiudadRequest struct {
	Nombre string `json:"nombre"`
}

type UpdateCiudadRequest struct {
	Nombre string `json:"nombre"`
	Status *bool  `json:"status"`
}