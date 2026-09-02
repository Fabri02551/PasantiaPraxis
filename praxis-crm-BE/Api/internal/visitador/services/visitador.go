package services

import (
	"context"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visitador/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visitador/repository"
)

type VisitadorService struct {
	repo *repository.VisitadorRepository
}

func NewVisitadorService(repo *repository.VisitadorRepository) *VisitadorService {
	return &VisitadorService{repo: repo}
}

func (s *VisitadorService) Create(ctx context.Context, v *models.Visitador) error {
	return s.repo.Create(ctx, v)
}

func (s *VisitadorService) List(ctx context.Context) ([]models.Visitador, error) {
	return s.repo.List(ctx)
}

func (s *VisitadorService) GetByID(ctx context.Context, id int) (*models.Visitador, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *VisitadorService) Update(ctx context.Context, id int, v *models.UpdateVisitadorRequest) error {
	return s.repo.Update(ctx, id, v)
}

func (s *VisitadorService) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}
