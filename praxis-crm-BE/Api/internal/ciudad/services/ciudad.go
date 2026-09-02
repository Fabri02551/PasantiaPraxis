package services

import (
	"context"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/ciudad/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/ciudad/repository"
)

type CiudadService struct {
	repo *repository.CiudadRepository
}

func NewCiudadService(repo *repository.CiudadRepository) *CiudadService {
	return &CiudadService{repo: repo}
}

func (s *CiudadService) GetAll(ctx context.Context) ([]models.Ciudad, error) {
	return s.repo.GetAll(ctx)
}

func (s *CiudadService) GetByID(ctx context.Context, id int) (*models.Ciudad, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *CiudadService) Create(ctx context.Context, req models.CreateCiudadRequest) (*models.Ciudad, error) {
	return s.repo.Create(ctx, req)
}

func (s *CiudadService) Update(ctx context.Context, id int, req models.UpdateCiudadRequest) (*models.Ciudad, error) {
	return s.repo.Update(ctx, id, req)
}

func (s *CiudadService) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}