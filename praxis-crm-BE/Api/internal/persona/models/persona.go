package models

import (
	"time"
)

type Persona struct {
	ID        int        `json:"id"`
	Nombres   string     `json:"nombres"`
	Apellidos string     `json:"apellidos"`
	Sexo      string     `json:"sexo"`
	Correo    string     `json:"correo"`
	Telefono  string     `json:"telefono"`
	Nacimiento *time.Time `json:"nacimiento,omitempty"`
	CI        string     `json:"ci"`
	CiudadID  *int       `json:"ciudad_id,omitempty"`
	Status    bool       `json:"status"`
	CreatedAt time.Time  `json:"created_at,omitempty"`
}

type CreatePersonaRequest struct {
	Nombres    string     `json:"nombres"`
	Apellidos  string     `json:"apellidos"`
	Sexo       string     `json:"sexo"`
	Correo     string     `json:"correo"`
	Telefono   string     `json:"telefono"`
	Nacimiento *time.Time `json:"nacimiento,omitempty"`
	CI         string     `json:"ci"`
	CiudadID   *int       `json:"ciudad_id,omitempty"`
}

type UpdatePersonaRequest struct {
	Nombres    string     `json:"nombres"`
	Apellidos  string     `json:"apellidos"`
	Sexo       string     `json:"sexo"`
	Correo     string     `json:"correo"`
	Telefono   string     `json:"telefono"`
	Nacimiento *time.Time `json:"nacimiento,omitempty"`
	CI         string     `json:"ci"`
	CiudadID   *int       `json:"ciudad_id,omitempty"`
	Status     *bool      `json:"status"`
}