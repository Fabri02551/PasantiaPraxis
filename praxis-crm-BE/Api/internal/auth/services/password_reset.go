package services

import (
	"context"
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/repository"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/config"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/email"
)

type PasswordResetService struct {
	resetRepo *repository.PasswordResetRepository
	authRepo  *repository.AuthRepository
	emailSvc  *email.Service
	cfg       config.Config
}

func NewPasswordResetService(resetRepo *repository.PasswordResetRepository, authRepo *repository.AuthRepository, emailSvc *email.Service, cfg config.Config) *PasswordResetService {
	return &PasswordResetService{resetRepo: resetRepo, authRepo: authRepo, emailSvc: emailSvc, cfg: cfg}
}

func (s *PasswordResetService) ForgotPassword(ctx context.Context, req models.ForgotPasswordRequest) error {
	emailAddr := strings.TrimSpace(strings.ToLower(req.Email))
	if emailAddr == "" {
		return errors.New("email requerido")
	}
	user, _ := s.authRepo.GetByEmail(ctx, emailAddr)
	if user == nil {
		return nil
	}
	token, err := s.resetRepo.CreateToken(ctx, emailAddr)
	if err != nil {
		return err
	}
	_ = s.emailSvc.SendResetPassword(email.SendResetPasswordInput{
		To:        emailAddr,
		Token:     token.Token,
		AppURL:    req.AppURL,
		ExpiresIn: "30 minutos",
	})
	return nil
}

func (s *PasswordResetService) ResetPassword(ctx context.Context, req models.ResetPasswordRequest) error {
	if req.Token == "" || req.Password == "" {
		return errors.New("token y password requeridos")
	}
	if len(req.Password) < 6 {
		return errors.New("el password debe tener al menos 6 caracteres")
	}
	t, err := s.resetRepo.GetValidToken(ctx, req.Token)
	if err != nil {
		return err
	}
	user, err := s.authRepo.GetByEmail(ctx, t.Email)
	if err != nil {
		return errors.New("usuario no encontrado")
	}
	if user == nil {
		return errors.New("usuario no encontrado")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if err := s.authRepo.UpdatePasswordByEmail(ctx, t.Email, string(hash)); err != nil {
		return err
	}
	_ = s.resetRepo.MarkUsed(ctx, req.Token)
	return nil
}
