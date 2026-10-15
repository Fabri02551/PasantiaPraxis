package services

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"time"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/medico/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/medico/repository"
)

// ErrForbidden marca el intento de tocar un médico que no pertenece a la
// cartera del visitador que hace la petición.
var ErrForbidden = errors.New("este médico no pertenece a tu cartera")

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

func (s *MedicoService) Update(ctx context.Context, userID *int, role string, personaID int, req models.UpdateMedicoRequest) (*models.Medico, error) {
	// El visitador solo puede tocar médicos de SU cartera, y dentro de esos
	// médicos solo la matrícula y las direcciones (funciones temporales).
	// El admin conserva el PUT completo de siempre.
	if role == "visitador" {
		actual, err := s.repo.GetByID(ctx, personaID)
		if err != nil {
			return nil, err
		}
		if actual.VisitadorID == nil || userID == nil || *actual.VisitadorID != *userID {
			return nil, ErrForbidden
		}
		// Reconstruimos la request conservando los valores actuales del
		// médico en todo lo que el visitador NO puede tocar: así el
		// UPDATE del repo no pisa nada por el camino (ojo: los campos en
		// cero de la struct viajan como '' y el COALESCE del repo los
		// aplicaría). Solo viajan matricula y direccion.
		req = models.UpdateMedicoRequest{
			Matricula:        req.Matricula,
			Direccion:        req.Direccion,
			MarcarDuplicado:  req.MarcarDuplicado,
			Codigo:           actual.Codigo,
			EspecialidadID:   &actual.EspecialidadID,
			VisitadorID:      actual.VisitadorID,
			EsParticular:     &actual.EsParticular,
			Clasificacion:    &actual.Clasificacion,
			FrecuenciaVisita: actual.FrecuenciaVisita,
			Notas:            actual.Notas,
			Status:           &actual.Status,
		}
	}

	// "Marcar como duplicado": baja lógica + matrícula nueva generada que no
	// exista en la base. Si viene en la request, pisa matrícula y status.
	if req.MarcarDuplicado != nil && *req.MarcarDuplicado {
		matricula, err := s.matriculaLibreDuplicado(ctx, personaID)
		if err != nil {
			return nil, err
		}
		req.Matricula = &matricula
		inactivo := false
		req.Status = &inactivo
	}

	return s.repo.Update(ctx, userID, personaID, req)
}

// matriculaLibreDuplicado genera una matrícula con forma DUP-YYMMDD-xxxxxx y
// verifica contra la base que no esté en uso (hasta 10 intentos).
func (s *MedicoService) matriculaLibreDuplicado(ctx context.Context, personaID int) (string, error) {
	const intentos = 10
	for i := 0; i < intentos; i++ {
		candidata := fmt.Sprintf("DUP-%s-%s", time.Now().Format("060102"), sufijoAleatorio(3))
		ocupada, err := s.repo.MatriculaExists(ctx, candidata, personaID)
		if err != nil {
			return "", err
		}
		if !ocupada {
			return candidata, nil
		}
	}
	return "", fmt.Errorf("no se pudo generar una matrícula de duplicado libre")
}

func sufijoAleatorio(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
	}
	return fmt.Sprintf("%x", b)
}

func (s *MedicoService) Delete(ctx context.Context, userID *int, personaID int) error {
	return s.repo.Delete(ctx, userID, personaID)
}

func (s *MedicoService) GetPersonaSexo(ctx context.Context, personaID int) (string, error) {
	return s.repo.GetPersonaSexo(ctx, personaID)
}
