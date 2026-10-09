package models

import (
	"errors"
	"time"
)

// ErrCorreoYaRegistrado marca un intento de crear un visitador con un correo
// que ya tiene cuenta en users. Lo usan el repositorio para devolverlo y el
// handler para responder 409 en vez de 500.
var ErrCorreoYaRegistrado = errors.New("el correo ya está registrado por otro usuario")

type Visitador struct {
	PersonaID       int       `json:"persona_id"`
	Nombre          string    `json:"nombre"`
	PrimerApellido  string    `json:"primer_apellido"`
	SegundoApellido *string   `json:"segundo_apellido,omitempty"`
	Sexo            string    `json:"sexo"`
	Correo          string    `json:"correo"`
	Telefono        string    `json:"telefono"`
	CI              string    `json:"ci"`
	Latitud         *float64  `json:"latitud,omitempty"`
	Longitud        *float64  `json:"longitud,omitempty"`
	Activo          bool      `json:"activo"`
	CreadoPor       *int      `json:"creado_por,omitempty"`
	ModificadoPor   *int      `json:"modificado_por,omitempty"`
	FechaCreacion   time.Time `json:"fecha_creacion"`
	UltimaModificacion time.Time `json:"ultima_modificacion"`
}

type CreateVisitadorRequest struct {
	PersonaID       int      `json:"persona_id"`
	Nombre          string   `json:"nombre"`
	PrimerApellido  string   `json:"primer_apellido"`
	SegundoApellido *string  `json:"segundo_apellido,omitempty"`
	Sexo            string   `json:"sexo"`
	Correo          string   `json:"correo"`
	Telefono        string   `json:"telefono"`
	CI              string   `json:"ci"`
	Latitud         *float64 `json:"latitud,omitempty"`
	Longitud        *float64 `json:"longitud,omitempty"`
}

type UpdateVisitadorRequest struct {
	Nombre          string   `json:"nombre"`
	PrimerApellido  string   `json:"primer_apellido"`
	SegundoApellido *string  `json:"segundo_apellido,omitempty"`
	Telefono        string   `json:"telefono"`
	Activo          *bool    `json:"activo"`
	Latitud         *float64 `json:"latitud,omitempty"`
	Longitud        *float64 `json:"longitud,omitempty"`
}
