package services

import (
	"context"
	"crypto/rand"
	"math/big"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/email"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visitador/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visitador/repository"
)

const passwordCharset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"

type AuthRepo interface {
	CreateUser(ctx context.Context, personaID int, email, passwordHash string) error
	UserExists(ctx context.Context, email string) bool
}

type VisitadorService struct {
	repo     *repository.VisitadorRepository
	emailSvc *email.Service
	authRepo AuthRepo
}

func NewVisitadorService(repo *repository.VisitadorRepository, emailSvc *email.Service, authRepo AuthRepo) *VisitadorService {
	return &VisitadorService{repo: repo, emailSvc: emailSvc, authRepo: authRepo}
}

func randomPassword() (string, error) {
	var sb strings.Builder
	for i := 0; i < 12; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(passwordCharset))))
		if err != nil {
			return "", err
		}
		sb.WriteByte(passwordCharset[n.Int64()])
	}
	return sb.String(), nil
}

func hashPass(p string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(p), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(h), nil
}

func (s *VisitadorService) Create(ctx context.Context, userID *int, v *models.Visitador) error {
	personaID, err := s.repo.Create(ctx, userID, v)
	if err != nil {
		return err
	}
	if v.Correo != "" && s.authRepo != nil && !s.authRepo.UserExists(ctx, strings.ToLower(v.Correo)) {
		pass, err := randomPassword()
		if err == nil {
			if h, err := hashPass(pass); err == nil {
				_ = s.authRepo.CreateUser(ctx, personaID, strings.ToLower(v.Correo), h)
				if s.emailSvc != nil {
					_ = s.emailSvc.SendCredentials(email.SendCredentialsInput{
						To:       strings.ToLower(v.Correo),
						Email:    strings.ToLower(v.Correo),
						Password: pass,
						AppURL:   "https://crm.laboratoriopraxis.com",
					})
				}
			}
		}
	}
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
