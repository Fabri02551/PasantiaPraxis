package models

import "time"

type Visitador struct {
	PersonaID       int       `json:"persona_id"`
	Nombre          string    `json:"nombre"`
	PrimerApellido  string    `json:"primer_apellido"`
	SegundoApellido *string   `json:"segundo_apellido,omitempty"`
	Sexo            string    `json:"sexo"`
	Correo          string    `json:"correo"`
	Telefono        string    `json:"telefono"`
	CI              string    `json:"ci"`
	Activo          bool      `json:"activo"`
	CreatedAt       time.Time `json:"created_at"`
}

type CreateVisitadorRequest struct {
	PersonaID       int     `json:"persona_id"`
	Nombre          string  `json:"nombre"`
	PrimerApellido  string  `json:"primer_apellido"`
	SegundoApellido *string `json:"segundo_apellido,omitempty"`
	Sexo            string  `json:"sexo"`
	Correo          string  `json:"correo"`
	Telefono        string  `json:"telefono"`
	CI              string  `json:"ci"`
}

type UpdateVisitadorRequest struct {
	Nombre          string  `json:"nombre"`
	PrimerApellido  string  `json:"primer_apellido"`
	SegundoApellido *string `json:"segundo_apellido,omitempty"`
	Telefono        string  `json:"telefono"`
	Activo          *bool   `json:"activo"`
}
