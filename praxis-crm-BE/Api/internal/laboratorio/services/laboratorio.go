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

func (s *LaboratorioService) GetPreciosPorCiudad(ctx context.Context, ciudadID *int) ([]models.LaboratorioPrecio, error) {
	return s.repo.GetPreciosPorCiudad(ctx, ciudadID)
}

func (s *LaboratorioService) Create(ctx context.Context, userID *int, req models.CreateLaboratorioRequest) (*models.Laboratorio, error) {
	return s.repo.Create(ctx, userID, req)
}

func (s *LaboratorioService) Update(ctx context.Context, userID *int, id int, req models.UpdateLaboratorioRequest) (*models.Laboratorio, error) {
	return s.repo.Update(ctx, userID, id, req)
}

func (s *LaboratorioService) Delete(ctx context.Context, userID *int, id int) error {
	return s.repo.Delete(ctx, userID, id)
}