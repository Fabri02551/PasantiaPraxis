package services

import (
	"context"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/accion/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/accion/repository"
)

type AccionService struct {
	repo *repository.AccionRepository
}

func NewAccionService(repo *repository.AccionRepository) *AccionService {
	return &AccionService{repo: repo}
}

func (s *AccionService) GetAll(ctx context.Context) ([]models.Accion, error) {
	return s.repo.GetAll(ctx)
}

func (s *AccionService) GetByID(ctx context.Context, id int) (*models.Accion, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *AccionService) Create(ctx context.Context, req models.CreateAccionRequest) (*models.Accion, error) {
	return s.repo.Create(ctx, req)
}

func (s *AccionService) Update(ctx context.Context, id int, req models.UpdateAccionRequest) (*models.Accion, error) {
	return s.repo.Update(ctx, id, req)
}

func (s *AccionService) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}