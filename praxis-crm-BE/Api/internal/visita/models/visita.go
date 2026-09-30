package models

import (
	"encoding/json"
	"time"
)

// Visita: `latitud`/`longitud` son el GPS del VISITADOR al completar la
// visita (insumo de auditoría), NO la dirección del médico. La del destino
// va aparte, en `destino_latitud`/`destino_longitud`, congelada como snapshot.
type Visita struct {
	ID                    int             `json:"id"`
	IDVisitador           int             `json:"id_visitador"`
	IDMedico              *int            `json:"id_medico,omitempty"`
	InstitucionID         *int            `json:"institucion_id,omitempty"`
	FechaVisita           *time.Time      `json:"fecha_visita,omitempty"`
	FechaVisitaTentativa  *time.Time      `json:"fecha_visita_tentativa,omitempty"`
	Latitud               *float64        `json:"latitud,omitempty"`
	Longitud              *float64        `json:"longitud,omitempty"`
	UbicacionDestinoID    *string         `json:"ubicacion_destino_id,omitempty"`
	DestinoDireccion      *string         `json:"destino_direccion,omitempty"`
	DestinoLatitud        *float64        `json:"destino_latitud,omitempty"`
	DestinoLongitud       *float64        `json:"destino_longitud,omitempty"`
	GPSPrecisionM         *float64        `json:"gps_precision_m,omitempty"`
	DistanciaDestinoM     *float64        `json:"distancia_destino_m,omitempty"`
	SinEvidenciaUbicacion bool            `json:"sin_evidencia_ubicacion"`
	Firma                 string          `json:"firma"`
	Observacion           json.RawMessage `json:"observacion"`
	Satisfaccion          int             `json:"satisfaccion"`
	Duracion              int             `json:"duracion"`
	Ingreso               string          `json:"ingreso"`
	Papeleta              int             `json:"papeleta"`
	Registrada            bool            `json:"registrada"`
	Estado                string          `json:"estado"`
	Extraordinaria        bool            `json:"extraordinaria"`
}

// CreateVisitaRequest es lo que llena el admin o el planificador al programar
// una visita: visitador, médico o institución a visitar y fecha tentativa.
type CreateVisitaRequest struct {
	IDVisitador          int        `json:"id_visitador"`
	IDMedico             *int       `json:"id_medico,omitempty"`
	InstitucionID        *int       `json:"institucion_id,omitempty"`
	FechaVisitaTentativa *time.Time `json:"fecha_visita_tentativa,omitempty"`
	Extraordinaria       bool       `json:"extraordinaria,omitempty"`
	// Ubicación del destino elegida al planificar (id dentro del array de
	// ubicaciones de médico o institución). Opcional: se puede confirmar o
	// corregir al completar la visita.
	UbicacionDestinoID *string `json:"ubicacion_destino_id,omitempty"`
}

type UpdateVisitaRequest struct {
	IDVisitador          *int       `json:"id_visitador,omitempty"`
	IDMedico             *int       `json:"id_medico,omitempty"`
	InstitucionID        *int       `json:"institucion_id,omitempty"`
	FechaVisitaTentativa *time.Time `json:"fecha_visita_tentativa,omitempty"`
	UbicacionDestinoID   *string    `json:"ubicacion_destino_id,omitempty"`
}

// RegistrarVisitaRequest es lo que llena el visitador cuando hace la visita
// real: todo excepto la fecha tentativa (que ya se guardó al crear la visita).
//
// GPS: Latitud/Longitud son la posición del VISITADOR en ese momento.
// GPSPrecisionM es la precisión que reportó el dispositivo; DistanciaDestinoM
// NO viene del cliente: la calcula el servidor con la fórmula haversine contra
// el pin del destino, para que la auditoría no dependa de lo que mande el
// navegador. SinEvidenciaUbicacion lo marca el visitador cuando denegó el
// permiso: la visita se guarda igual, pero queda señalada para el admin.
type RegistrarVisitaRequest struct {
	FechaVisita           *time.Time      `json:"fecha_visita"`
	Latitud               *float64        `json:"latitud,omitempty"`
	Longitud              *float64        `json:"longitud,omitempty"`
	GPSPrecisionM         *float64        `json:"gps_precision_m,omitempty"`
	SinEvidenciaUbicacion bool            `json:"sin_evidencia_ubicacion,omitempty"`
	UbicacionDestinoID    *string         `json:"ubicacion_destino_id,omitempty"`
	DestinoDireccion      *string         `json:"destino_direccion,omitempty"`
	DestinoLatitud        *float64        `json:"destino_latitud,omitempty"`
	DestinoLongitud       *float64        `json:"destino_longitud,omitempty"`
	Firma                 string          `json:"firma"`
	Observacion           json.RawMessage `json:"observacion,omitempty"`
	Satisfaccion          int             `json:"satisfaccion"`
	Duracion              int             `json:"duracion"`
	Papeleta              int             `json:"papeleta"`
	// Distancia calculada por el servidor. Se exporta para que el service lo
	// asigne antes de llamar al repo, pero no viene del JSON del cliente.
	DistanciaDestinoM *float64 `json:"-"`
}

type VisitaLaboratorio struct {
	LaboratorioID int     `json:"laboratorio_id"`
	Nombre        string  `json:"nombre"`
	Area          string  `json:"area"`
	Costo         float64 `json:"costo"`
	Cantidad      int     `json:"cantidad"`
}

// AddLaboratorioItem estudio con la cantidad solicitada en la cotización.
type AddLaboratorioItem struct {
	LaboratorioID int `json:"laboratorio_id"`
	Cantidad      int `json:"cantidad"`
}

type AddLaboratoriosRequest struct {
	Laboratorios []AddLaboratorioItem `json:"laboratorios"`
}
