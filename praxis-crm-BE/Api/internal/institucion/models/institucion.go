package models

import (
	"encoding/json"
	"time"
)

type Institucion struct {
	ID            int             `json:"id"`
	Nombre        string          `json:"nombre"`
	RazonSocial   string          `json:"razon_social"`
	Direccion     json.RawMessage `json:"direccion"`
	Telefono      string          `json:"telefono"`
	Correo        string          `json:"correo"`
	TipoContrato  string          `json:"tipo_contrato"`
	NIT           string          `json:"nit"`
	VisitadorID   *int            `json:"visitador_id,omitempty"`
	CiudadID      *int            `json:"ciudad_id,omitempty"`
	EsParticular  bool            `json:"es_particular"`
	Clasificacion int             `json:"clasificacion"`
	Status        bool            `json:"status"`
	CreadoPor     *int            `json:"creado_por,omitempty"`
	ModificadoPor *int            `json:"modificado_por,omitempty"`
	FechaCreacion time.Time       `json:"fecha_creacion"`
	UltimaModificacion time.Time  `json:"ultima_modificacion"`
}

type CreateInstitucionRequest struct {
	Nombre        string          `json:"nombre"`
	RazonSocial   string          `json:"razon_social"`
	Direccion     json.RawMessage `json:"direccion,omitempty"`
	Telefono      string          `json:"telefono"`
	Correo        string          `json:"correo"`
	TipoContrato  string          `json:"tipo_contrato"`
	NIT           string          `json:"nit"`
	VisitadorID   *int            `json:"visitador_id,omitempty"`
	CiudadID      *int            `json:"ciudad_id,omitempty"`
	EsParticular  bool            `json:"es_particular"`
	Clasificacion int             `json:"clasificacion"`
}

type UpdateInstitucionRequest struct {
	Nombre        *string         `json:"nombre,omitempty"`
	RazonSocial   *string         `json:"razon_social,omitempty"`
	Direccion     json.RawMessage `json:"direccion,omitempty"`
	Telefono      *string         `json:"telefono,omitempty"`
	Correo        *string         `json:"correo,omitempty"`
	TipoContrato  *string         `json:"tipo_contrato,omitempty"`
	NIT           *string         `json:"nit,omitempty"`
	VisitadorID   *int            `json:"visitador_id,omitempty"`
	CiudadID      *int            `json:"ciudad_id,omitempty"`
	EsParticular  *bool           `json:"es_particular"`
	Clasificacion *int            `json:"clasificacion,omitempty"`
	Status        *bool           `json:"status"`
}