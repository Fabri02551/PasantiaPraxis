package services

import (
	"context"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/medico/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/medico/repository"
)

type MedicoService struct {
	repo *repository.MedicoRepository
}

func NewMedicoService(repo *repository.MedicoRepository) *MedicoService {
	return &MedicoService{repo: repo}
}

func (s *MedicoService) GetAll(ctx context.Context) ([]models.Medico, error) {
	return s.repo.GetAll(ctx)
}

func (s *MedicoService) GetByID(ctx context.Context, personaID int) (*models.Medico, error) {
	return s.repo.GetByID(ctx, personaID)
}

func (s *MedicoService) Create(ctx context.Context, req models.CreateMedicoRequest) (*models.Medico, error) {
	return s.repo.Create(ctx, req)
}

func (s *MedicoService) Update(ctx context.Context, personaID int, req models.UpdateMedicoRequest) (*models.Medico, error) {
	return s.repo.Update(ctx, personaID, req)
}

func (s *MedicoService) Delete(ctx context.Context, personaID int) error {
	return s.repo.Delete(ctx, personaID)
}