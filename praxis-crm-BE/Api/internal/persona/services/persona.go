package services

import (
	"context"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/persona/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/persona/repository"
)

type PersonaService struct {
	repo *repository.PersonaRepository
}

func NewPersonaService(repo *repository.PersonaRepository) *PersonaService {
	return &PersonaService{repo: repo}
}

func (s *PersonaService) GetAll(ctx context.Context) ([]models.Persona, error) {
	return s.repo.GetAll(ctx)
}

func (s *PersonaService) GetByID(ctx context.Context, id int) (*models.Persona, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *PersonaService) Create(ctx context.Context, req models.CreatePersonaRequest) (*models.Persona, error) {
	return s.repo.Create(ctx, req)
}

func (s *PersonaService) Update(ctx context.Context, id int, req models.UpdatePersonaRequest) (*models.Persona, error) {
	return s.repo.Update(ctx, id, req)
}

func (s *PersonaService) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}