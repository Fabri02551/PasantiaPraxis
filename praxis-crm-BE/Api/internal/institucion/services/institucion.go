package services

import (
	"context"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/institucion/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/institucion/repository"
)

type InstitucionService struct {
	repo *repository.InstitucionRepository
}

func NewInstitucionService(repo *repository.InstitucionRepository) *InstitucionService {
	return &InstitucionService{repo: repo}
}

func (s *InstitucionService) GetAll(ctx context.Context) ([]models.Institucion, error) {
	return s.repo.GetAll(ctx)
}

func (s *InstitucionService) GetByID(ctx context.Context, id int) (*models.Institucion, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *InstitucionService) Create(ctx context.Context, userID *int, req models.CreateInstitucionRequest) (*models.Institucion, error) {
	return s.repo.Create(ctx, userID, req)
}

func (s *InstitucionService) Update(ctx context.Context, userID *int, id int, req models.UpdateInstitucionRequest) (*models.Institucion, error) {
	return s.repo.Update(ctx, userID, id, req)
}

func (s *InstitucionService) Delete(ctx context.Context, userID *int, id int) error {
	return s.repo.Delete(ctx, userID, id)
}