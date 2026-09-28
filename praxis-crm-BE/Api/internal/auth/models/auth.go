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
	CreatedAt       time.Time  `json:"created_at"`
}

type UserWithPersona struct {
	User
	Persona
}

// ProfileResponse aplana User + Persona para GET/PUT /api/auth/me.
// No se puede serializar UserWithPersona directamente: al embeber Persona,
// User.ID y Persona.ID quedan al mismo nivel y encoding/json descarta los
// dos campos, así que `id` y `created_at` desaparecen de la respuesta.
type ProfileResponse struct {
	ID              string     `json:"id"`
	PersonaID       *int       `json:"persona_id"`
	Email           string     `json:"email"`
	Role            string     `json:"role"`
	Nombre          string     `json:"nombre"`
	PrimerApellido  string     `json:"primer_apellido"`
	SegundoApellido *string    `json:"segundo_apellido"`
	Sexo            string     `json:"sexo"`
	Correo          string     `json:"correo"`
	Telefono        string     `json:"telefono"`
	Nacimiento      *time.Time `json:"nacimiento"`
	CI              string     `json:"ci"`
	CreatedAt       time.Time  `json:"created_at"`
}

func (u *UserWithPersona) ToProfile() *ProfileResponse {
	return &ProfileResponse{
		ID:              u.User.ID,
		PersonaID:       u.User.PersonaID,
		Email:           u.User.Email,
		Role:            u.User.Role,
		Nombre:          u.Persona.Nombre,
		PrimerApellido:  u.Persona.PrimerApellido,
		SegundoApellido: u.Persona.SegundoApellido,
		Sexo:            u.Persona.Sexo,
		Correo:          u.Persona.Correo,
		Telefono:        u.Persona.Telefono,
		Nacimiento:      u.Persona.Nacimiento,
		CI:              u.Persona.CI,
		CreatedAt:       u.User.CreatedAt,
	}
}

// UpdateProfileRequest solo incluye campos de persona que el usuario puede
// editar desde "Mi Perfil". No lleva email: users.email es la credencial de
// login y no se modifica desde el perfil para no desincronizar la sesión.
// Nacimiento es *string (yyyy-mm-dd) y no *time.Time porque la columna es
// DATE: mandar un timestamptz dejaría el día corrido según el TimeZone de
// la sesión de Postgres.
type UpdateProfileRequest struct {
	Nombre          string  `json:"nombre"`
	PrimerApellido  string  `json:"primer_apellido"`
	SegundoApellido *string `json:"segundo_apellido"`
	Sexo            string  `json:"sexo"`
	Telefono        string  `json:"telefono"`
	Nacimiento      *string `json:"nacimiento"`
	CI              string  `json:"ci"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Email           string `json:"email"`
	Password        string `json:"password"`
	Role            string `json:"role"`
	Nombre          string `json:"nombre"`
	PrimerApellido  string `json:"primer_apellido"`
	SegundoApellido string `json:"segundo_apellido"`
	Sexo            string `json:"sexo"`
	Telefono        string `json:"telefono"`
	CI              string `json:"ci"`
}

type TokenResponse struct {
	Token     string `json:"token"`
	TokenType string `json:"token_type"`
	ExpiresIn int64  `json:"expires_in"`
	Role      string `json:"role"`
}
