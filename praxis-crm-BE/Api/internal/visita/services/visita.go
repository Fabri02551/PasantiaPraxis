package services

import (
	"context"
	"math"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visita/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visita/repository"
)

type VisitaService struct {
	repo *repository.VisitaRepository
}

func NewVisitaService(repo *repository.VisitaRepository) *VisitaService {
	return &VisitaService{repo: repo}
}

func (s *VisitaService) GetAll(ctx context.Context) ([]models.Visita, error) {
	return s.repo.GetAll(ctx)
}

func (s *VisitaService) GetByID(ctx context.Context, id int) (*models.Visita, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *VisitaService) Create(ctx context.Context, req models.CreateVisitaRequest) (*models.Visita, error) {
	return s.repo.Create(ctx, req)
}

func (s *VisitaService) Update(ctx context.Context, id int, req models.UpdateVisitaRequest) (*models.Visita, error) {
	return s.repo.Update(ctx, id, req)
}

// Distancia en metros entre dos puntos de la Tierra, con la fórmula haversine.
// Se usa para auditar: cuánto estaba el visitador del pin del destino.
//
// earthRadiusMetros es el radio medio terrestre (IUGG).
const earthRadiusMetros = 6371000.0

// calcularDistancia devuelve los metros entre (lat1, lon1) y (lat2, lon2), o
// nil si falta alguna coordenada. nil es distinto de 0 a propósito: 0 metros
// significa "estaba exactamente ahí", nil significa "no hay con qué comparar".
func calcularDistancia(lat1, lon1, lat2, lon2 float64) *float64 {
	radio := earthRadiusMetros
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	d := radio * c
	return &d
}

func (s *VisitaService) Registrar(ctx context.Context, id int, req models.RegistrarVisitaRequest) (*models.Visita, error) {
	// La distancia se calcula acá, en el servidor. Si la aceptáramos del
	// cliente, el visitador podría reportar la que quiera y la auditoría no
	// serviría de nada.
	if req.Latitud != nil && req.Longitud != nil && req.DestinoLatitud != nil && req.DestinoLongitud != nil {
		req.DistanciaDestinoM = calcularDistancia(*req.Latitud, *req.Longitud, *req.DestinoLatitud, *req.DestinoLongitud)
	}
	// Coherencia: si el GPS no llegó, no puede haber distancia, y la visita
	// queda marcada para que el admin la revise.
	if req.Latitud == nil || req.Longitud == nil {
		req.SinEvidenciaUbicacion = true
	}
	return s.repo.Registrar(ctx, id, req)
}

func (s *VisitaService) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

func (s *VisitaService) GetLaboratorios(ctx context.Context, visitaID int) ([]models.VisitaLaboratorio, error) {
	return s.repo.GetLaboratorios(ctx, visitaID)
}

func (s *VisitaService) AddLaboratorios(ctx context.Context, visitaID int, req models.AddLaboratoriosRequest) ([]models.VisitaLaboratorio, error) {
	return s.repo.AddLaboratorios(ctx, visitaID, req.Laboratorios)
}

func (s *VisitaService) RemoveLaboratorio(ctx context.Context, visitaID, laboratorioID int) ([]models.VisitaLaboratorio, error) {
	return s.repo.RemoveLaboratorio(ctx, visitaID, laboratorioID)
}
