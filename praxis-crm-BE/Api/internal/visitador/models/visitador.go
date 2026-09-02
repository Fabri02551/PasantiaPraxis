package models

import "time"

type Visitador struct {
	PersonaID  int       `json:"persona_id"`
	Nombres    string    `json:"nombres"`
	Apellidos  string    `json:"apellidos"`
	Sexo       string    `json:"sexo"`
	Correo     string    `json:"correo"`
	Telefono   string    `json:"telefono"`
	CI         string    `json:"ci"`
	Activo     bool      `json:"activo"`
	CreatedAt  time.Time `json:"created_at"`
}

type CreateVisitadorRequest struct {
	PersonaID int    `json:"persona_id"`
	Nombres   string `json:"nombres"`
	Apellidos string `json:"apellidos"`
	Sexo      string `json:"sexo"`
	Correo    string `json:"correo"`
	Telefono  string `json:"telefono"`
	CI        string `json:"ci"`
}

type UpdateVisitadorRequest struct {
	Nombres   string `json:"nombres"`
	Apellidos string `json:"apellidos"`
	Telefono  string `json:"telefono"`
	Activo    *bool  `json:"activo"`
}
