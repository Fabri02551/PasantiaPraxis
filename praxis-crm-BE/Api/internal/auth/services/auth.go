package services

import (
	"context"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/repository"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/config"
)

type AuthService struct {
	repo *repository.AuthRepository
	cfg  config.Config
}

func NewAuthService(repo *repository.AuthRepository, cfg config.Config) *AuthService {
	return &AuthService{repo: repo, cfg: cfg}
}

func (s *AuthService) Register(ctx context.Context, req models.RegisterRequest) (*models.TokenResponse, error) {
	existing, _ := s.repo.GetByEmail(ctx, req.Email)
	if existing != nil {
		return nil, errors.New("el email ya está registrado")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	role := req.Role
	if role == "" {
		role = "visitador"
	}

	user := &models.User{
		Email: req.Email,
		Role:  role,
	}

	persona := &models.Persona{
		Nombres:   req.Nombres,
		Apellidos: req.Apellidos,
		Sexo:      req.Sexo,
		Correo:    req.Email,
		Telefono:  req.Telefono,
		CI:        req.CI,
	}

	if err := s.repo.CreateWithPersona(ctx, user, string(hash), persona); err != nil {
		return nil, err
	}

	return s.generateToken(user)
}

func (s *AuthService) Login(ctx context.Context, req models.LoginRequest) (*models.TokenResponse, error) {
	user, err := s.repo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, errors.New("credenciales inválidas")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("credenciales inválidas")
	}

	return s.generateToken(&user.User)
}

func (s *AuthService) GetByID(ctx context.Context, id string) (*models.UserWithPersona, error) {
	return s.repo.GetByID(ctx, id)
}

type Claims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

func (s *AuthService) generateToken(user *models.User) (*models.TokenResponse, error) {
	expiresAt := time.Now().Add(s.cfg.JWTExpiration)

	claims := &Claims{
		Role: user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return nil, err
	}

	return &models.TokenResponse{
		Token:     signed,
		TokenType: "Bearer",
		ExpiresIn: int64(s.cfg.JWTExpiration.Seconds()),
		Role:      user.Role,
	}, nil
}
