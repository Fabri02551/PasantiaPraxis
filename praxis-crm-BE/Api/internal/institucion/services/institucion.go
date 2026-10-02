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

func (s *InstitucionService) GetPage(ctx context.Context, page, limit int, q string) (int, []models.Institucion, error) {
	return s.repo.GetPage(ctx, page, limit, q)
}

// visitadorPorDefecto devuelve a quién queda asignada la institución nueva.
//
// Si la request trae un visitador_id explícito, manda ese. Si no, y el que crea
// es un visitador, la institución le queda a él (alta en campo del propio
// visitador). Si la crea un admin sin visitador_id, queda NULL (el admin lo
// asigna después con el actualizador). Misma regla que en el alta de médicos.
func visitadorPorDefecto(reqVisitadorID *int, userID *int, role string) *int {
	if reqVisitadorID != nil {
		return reqVisitadorID
	}
	if role == "visitador" {
		return userID
	}
	return nil
}

func (s *InstitucionService) Create(ctx context.Context, userID *int, role string, req models.CreateInstitucionRequest) (*models.Institucion, error) {
	req.VisitadorID = visitadorPorDefecto(req.VisitadorID, userID, role)
	return s.repo.Create(ctx, userID, req)
}

func (s *InstitucionService) Update(ctx context.Context, userID *int, id int, req models.UpdateInstitucionRequest) (*models.Institucion, error) {
	return s.repo.Update(ctx, userID, id, req)
}

func (s *InstitucionService) Delete(ctx context.Context, userID *int, id int) error {
	return s.repo.Delete(ctx, userID, id)
}