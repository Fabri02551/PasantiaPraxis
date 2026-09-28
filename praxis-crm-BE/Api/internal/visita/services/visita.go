package services

import (
	"context"

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

func (s *VisitaService) Registrar(ctx context.Context, id int, req models.RegistrarVisitaRequest) (*models.Visita, error) {
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