package services

import (
	"context"
	"errors"
	"log"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/config"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/pkg/mailer"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/pkg/passwd"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visitador/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visitador/repository"
)

type VisitadorService struct {
	repo *repository.VisitadorRepository
	cfg  config.Config
}

func NewVisitadorService(repo *repository.VisitadorRepository, cfg config.Config) *VisitadorService {
	return &VisitadorService{repo: repo, cfg: cfg}
}

// Create da de alta el visitador con su usuario (rol visitador) en UNA
// transacción y le manda las credenciales por correo.
//
// Devuelve la contraseña generada SOLO cuando no se pudo enviar el correo
// (sin SMTP o fallo del servidor): es la única copia en claro que sale de
// la API y el panel la muestra una vez para que el administrador la
// reparta a mano. Si el correo salió bien, vuelve vacío.
func (s *VisitadorService) Create(ctx context.Context, userID *int, v *models.Visitador) (string, error) {
	v.Correo = strings.TrimSpace(strings.ToLower(v.Correo))
	if v.Correo == "" {
		return "", errors.New("el correo es requerido: ahi se envian el usuario y la contraseña")
	}

	password, err := passwd.Random()
	if err != nil {
		return "", err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	personaID, err := s.repo.Create(ctx, userID, v, string(hash))
	if err != nil {
		return "", err
	}
	v.PersonaID = personaID

	if err := s.enviarCredenciales(v, password); err != nil {
		return password, nil
	}
	return "", nil
}

// enviarCredenciales manda la contraseña generada al correo del visitador.
// El envío es síncrono y acotado (2 intentos de 3s) para que, si falla,
// la contraseña todavía se pueda devolver en la respuesta del alta.
func (s *VisitadorService) enviarCredenciales(v *models.Visitador, password string) error {
	m := mailer.New(s.cfg)
	if !m.Habilitado() {
		return errors.New("smtp no configurado (SMTP_HOST vacío)")
	}
	nombre := strings.TrimSpace(v.Nombre + " " + v.PrimerApellido)
	if err := m.EnviarCredenciales(v.Correo, nombre, v.Correo, password, "visitador"); err != nil {
		mailer.AvisoCredenciales(v.Correo, err)
		return err
	}
	log.Printf("[mailer] credenciales de visitador enviadas a %s", v.Correo)
	return nil
}

func (s *VisitadorService) List(ctx context.Context) ([]models.Visitador, error) {
	return s.repo.List(ctx)
}

func (s *VisitadorService) GetByID(ctx context.Context, id int) (*models.Visitador, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *VisitadorService) Update(ctx context.Context, userID *int, id int, v *models.UpdateVisitadorRequest) error {
	return s.repo.Update(ctx, userID, id, v)
}

func (s *VisitadorService) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}
