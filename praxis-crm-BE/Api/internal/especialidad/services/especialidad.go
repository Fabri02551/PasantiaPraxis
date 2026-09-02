package services

import (
	"context"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/especialidad/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/especialidad/repository"
)

type EspecialidadService struct {
	repo *repository.EspecialidadRepository
}

func NewEspecialidadService(repo *repository.EspecialidadRepository) *EspecialidadService {
	return &EspecialidadService{repo: repo}
}

func (s *EspecialidadService) GetAll(ctx context.Context) ([]models.Especialidad, error) {
	return s.repo.GetAll(ctx)
}

func (s *EspecialidadService) GetByID(ctx context.Context, id int) (*models.Especialidad, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *EspecialidadService) Create(ctx context.Context, req models.CreateEspecialidadRequest) (*models.Especialidad, error) {
	return s.repo.Create(ctx, req)
}

func (s *EspecialidadService) Update(ctx context.Context, id int, req models.UpdateEspecialidadRequest) (*models.Especialidad, error) {
	return s.repo.Update(ctx, id, req)
}

func (s *EspecialidadService) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}