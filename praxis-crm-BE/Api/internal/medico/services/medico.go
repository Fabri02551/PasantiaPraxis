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

func (s *MedicoService) GetPage(ctx context.Context, page, limit int, q string) (int, []models.Medico, error) {
	return s.repo.GetPage(ctx, page, limit, q)
}

// visitadorPorDefecto devuelve a quién queda asignado el médico nuevo.
//
// Si la request trae un visitador_id explícito, manda ese. Si no, y el que crea
// es un visitador, el médico le queda a él: el alta en campo es del propio
// visitador. Si lo crea un admin sin visitador_id, queda NULL (el admin lo
// asigna después con el actualizador).
func visitadorPorDefecto(reqVisitadorID *int, userID *int, role string) *int {
	if reqVisitadorID != nil {
		return reqVisitadorID
	}
	if role == "visitador" {
		return userID
	}
	return nil
}

func (s *MedicoService) Create(ctx context.Context, userID *int, role string, req models.CreateMedicoRequest) (*models.Medico, error) {
	req.VisitadorID = visitadorPorDefecto(req.VisitadorID, userID, role)
	return s.repo.Create(ctx, userID, req)
}

// CreateCompleto crea persona + médico de forma atómica.
func (s *MedicoService) CreateCompleto(ctx context.Context, userID *int, role string, p models.PersonaInput, req models.CreateMedicoRequest) (*models.Medico, error) {
	req.VisitadorID = visitadorPorDefecto(req.VisitadorID, userID, role)
	return s.repo.CreateCompleto(ctx, userID, p, req)
}

func (s *MedicoService) Update(ctx context.Context, userID *int, personaID int, req models.UpdateMedicoRequest) (*models.Medico, error) {
	return s.repo.Update(ctx, userID, personaID, req)
}

func (s *MedicoService) Delete(ctx context.Context, userID *int, personaID int) error {
	return s.repo.Delete(ctx, userID, personaID)
}

func (s *MedicoService) GetPersonaSexo(ctx context.Context, personaID int) (string, error) {
	return s.repo.GetPersonaSexo(ctx, personaID)
}
