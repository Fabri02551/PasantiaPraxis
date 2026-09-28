package models

import "time"

type User struct {
	ID           string    `json:"id"`
	PersonaID    *int      `json:"persona_id,omitempty"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Persona struct {
	ID         int        `json:"id"`
	Nombres    string     `json:"nombres"`
	Apellidos  string     `json:"apellidos"`
	Sexo       string     `json:"sexo"`
	Correo     string     `json:"correo"`
	Telefono   string     `json:"telefono"`
	Nacimiento *time.Time `json:"nacimiento,omitempty"`
	CI         string     `json:"ci"`
	CiudadID   *int       `json:"ciudad_id,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

type UserWithPersona struct {
	User
	Persona
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Email     string `json:"email"`
	Password  string `json:"password"`
	Role      string `json:"role"`
	Nombres   string `json:"nombres"`
	Apellidos string `json:"apellidos"`
	Sexo      string `json:"sexo"`
	Telefono  string `json:"telefono"`
	CI        string `json:"ci"`
}

type TokenResponse struct {
	Token     string `json:"token"`
	TokenType string `json:"token_type"`
	ExpiresIn int64  `json:"expires_in"`
	Role      string `json:"role"`
}
