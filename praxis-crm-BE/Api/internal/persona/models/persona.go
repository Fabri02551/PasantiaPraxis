package models

import (
	"time"
)

type Persona struct {
	ID              int        `json:"id"`
	Nombre          string     `json:"nombre"`
	PrimerApellido  string     `json:"primer_apellido"`
	SegundoApellido *string    `json:"segundo_apellido,omitempty"`
	Sexo            string     `json:"sexo"`
	Correo          string     `json:"correo"`
	Telefono        string     `json:"telefono"`
	Nacimiento      *time.Time `json:"nacimiento,omitempty"`
	CI              string     `json:"ci"`
	CiudadID        *int       `json:"ciudad_id,omitempty"`
	Status          bool       `json:"status"`
	CreatedAt       time.Time  `json:"created_at,omitempty"`
}

type CreatePersonaRequest struct {
	Nombre          string     `json:"nombre"`
	PrimerApellido  string     `json:"primer_apellido"`
	SegundoApellido *string    `json:"segundo_apellido,omitempty"`
	Sexo            string     `json:"sexo"`
	Correo          string     `json:"correo"`
	Telefono        string     `json:"telefono"`
	Nacimiento      *time.Time `json:"nacimiento,omitempty"`
	CI              string     `json:"ci"`
	CiudadID        *int       `json:"ciudad_id,omitempty"`
}

type UpdatePersonaRequest struct {
	Nombre          string     `json:"nombre"`
	PrimerApellido  string     `json:"primer_apellido"`
	SegundoApellido *string    `json:"segundo_apellido,omitempty"`
	Sexo            string     `json:"sexo"`
	Correo          string     `json:"correo"`
	Telefono        string     `json:"telefono"`
	Nacimiento      *time.Time `json:"nacimiento,omitempty"`
	CI              string     `json:"ci"`
	CiudadID        *int       `json:"ciudad_id,omitempty"`
	Status          *bool      `json:"status"`
}
