package services

import (
	"context"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/laboratorio/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/laboratorio/repository"
)

type LaboratorioService struct {
	repo *repository.LaboratorioRepository
}

func NewLaboratorioService(repo *repository.LaboratorioRepository) *LaboratorioService {
	return &LaboratorioService{repo: repo}
}

func (s *LaboratorioService) GetAll(ctx context.Context) ([]models.Laboratorio, error) {
	return s.repo.GetAll(ctx)
}

func (s *LaboratorioService) GetByID(ctx context.Context, id int) (*models.Laboratorio, error) {
	return s.repo.GetByID(ctx, id)
}