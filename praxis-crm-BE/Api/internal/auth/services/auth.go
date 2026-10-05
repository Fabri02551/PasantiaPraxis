package services

import (
	"context"
	"errors"
	"strings"
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
		Nombre:         req.Nombre,
		PrimerApellido: req.PrimerApellido,
		Sexo:           req.Sexo,
		Correo:         req.Email,
		Telefono:       req.Telefono,
		CI:             req.CI,
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

	if !user.Persona.Status {
		return nil, errors.New("cuenta desactivada, contacta a otro administrador")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("credenciales inválidas")
	}

	return s.generateToken(&user.User)
}

func (s *AuthService) GetByID(ctx context.Context, id string) (*models.UserWithPersona, error) {
	return s.repo.GetByID(ctx, id)
}

// ============================================================
// CRUD de administradores (solo rol admin)
// ============================================================

func (s *AuthService) ListAdmins(ctx context.Context) ([]models.AdminItem, error) {
	admins, err := s.repo.ListAdmins(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]models.AdminItem, 0, len(admins))
	for i := range admins {
		items = append(items, *admins[i].ToAdmin())
	}
	return items, nil
}

func (s *AuthService) GetAdmin(ctx context.Context, personaID int) (*models.AdminItem, error) {
	up, err := s.repo.GetAdminByPersonaID(ctx, personaID)
	if err != nil {
		return nil, err
	}
	return up.ToAdmin(), nil
}

// CreateAdmin crea persona + usuario admin en UNA transacción.
func (s *AuthService) CreateAdmin(ctx context.Context, req models.CreateAdminRequest) (*models.AdminItem, error) {
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Nombre = strings.TrimSpace(req.Nombre)
	req.PrimerApellido = strings.TrimSpace(req.PrimerApellido)
	req.Sexo = strings.ToLower(strings.TrimSpace(req.Sexo))
	req.Telefono = strings.TrimSpace(req.Telefono)
	req.CI = strings.TrimSpace(req.CI)

	if req.Email == "" || req.Password == "" {
		return nil, errors.New("email y password son requeridos")
	}
	if len(req.Password) < 6 {
		return nil, errors.New("el password debe tener al menos 6 caracteres")
	}
	if req.Nombre == "" || req.PrimerApellido == "" {
		return nil, errors.New("nombre y primer apellido son requeridos")
	}
	if req.Sexo == "" {
		return nil, errors.New("sexo es requerido")
	}

	if existing, _ := s.repo.GetByEmail(ctx, req.Email); existing != nil {
		return nil, errors.New("el email ya está registrado")
	}

	var segundo *string
	if req.SegundoApellido != nil {
		if t := strings.TrimSpace(*req.SegundoApellido); t != "" {
			segundo = &t
		}
	}

	var nacimiento *time.Time
	if req.Nacimiento != nil {
		if t := strings.TrimSpace(*req.Nacimiento); t != "" {
			parsed, err := time.Parse("2006-01-02", t)
			if err != nil {
				return nil, errors.New("fecha de nacimiento inválida, se espera yyyy-mm-dd")
			}
			nacimiento = &parsed
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	personaID, err := s.repo.CreateAdmin(ctx, req.Email, string(hash), &models.Persona{
		Nombre:          req.Nombre,
		PrimerApellido:  req.PrimerApellido,
		SegundoApellido: segundo,
		Sexo:            req.Sexo,
		Correo:          req.Email,
		Telefono:        req.Telefono,
		Nacimiento:      nacimiento,
		CI:              req.CI,
		CiudadID:        req.CiudadID,
	})
	if err != nil {
		return nil, err
	}

	return s.GetAdmin(ctx, personaID)
}

// UpdateAdmin edita persona + credencial en UNA transacción.
func (s *AuthService) UpdateAdmin(ctx context.Context, personaID int, req models.UpdateAdminRequest) (*models.AdminItem, error) {
	if _, err := s.repo.GetAdminByPersonaID(ctx, personaID); err != nil {
		return nil, err
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Nombre = strings.TrimSpace(req.Nombre)
	req.PrimerApellido = strings.TrimSpace(req.PrimerApellido)
	req.Sexo = strings.ToLower(strings.TrimSpace(req.Sexo))
	req.Telefono = strings.TrimSpace(req.Telefono)
	req.CI = strings.TrimSpace(req.CI)
	req.Correo = strings.TrimSpace(req.Correo)
	if req.Correo == "" {
		req.Correo = req.Email
	}

	if req.Nombre == "" || req.PrimerApellido == "" {
		return nil, errors.New("nombre y primer apellido son requeridos")
	}

	if req.SegundoApellido != nil {
		if t := strings.TrimSpace(*req.SegundoApellido); t != "" {
			req.SegundoApellido = &t
		} else {
			req.SegundoApellido = nil
		}
	}

	if req.Nacimiento != nil {
		if t := strings.TrimSpace(*req.Nacimiento); t != "" {
			if _, err := time.Parse("2006-01-02", t); err != nil {
				return nil, errors.New("fecha de nacimiento inválida, se espera yyyy-mm-dd")
			}
			req.Nacimiento = &t
		} else {
			req.Nacimiento = nil
		}
	}

	if req.Email != "" {
		if existing, _ := s.repo.GetByEmail(ctx, req.Email); existing != nil {
			if existing.User.PersonaID == nil || *existing.User.PersonaID != personaID {
				return nil, errors.New("el email ya está registrado por otro usuario")
			}
		}
	}

	var hash string
	if strings.TrimSpace(req.Password) != "" {
		if len(req.Password) < 6 {
			return nil, errors.New("el password debe tener al menos 6 caracteres")
		}
		h, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		hash = string(h)
	}

	if err := s.repo.UpdateAdmin(ctx, personaID, req, hash); err != nil {
		return nil, err
	}

	return s.GetAdmin(ctx, personaID)
}

// DeleteAdmin es eliminación LÓGICA: persona.status true(1) -> false(0).
// No permite auto-eliminarse para no quedarse sin acceso.
func (s *AuthService) DeleteAdmin(ctx context.Context, requesterPersonaID *int, personaID int) error {
	if requesterPersonaID != nil && *requesterPersonaID == personaID {
		return errors.New("no puedes eliminar tu propia cuenta de administrador")
	}
	if _, err := s.repo.GetAdminByPersonaID(ctx, personaID); err != nil {
		return err
	}
	return s.repo.SetAdminStatus(ctx, personaID, false)
}

// GetProfile devuelve los datos del usuario autenticado, resueltos por el
// persona_id que viene en el token.
func (s *AuthService) GetProfile(ctx context.Context, personaID int) (*models.ProfileResponse, error) {
	user, err := s.repo.GetByPersonaID(ctx, personaID)
	if err != nil {
		return nil, err
	}
	return user.ToProfile(), nil
}

func (s *AuthService) UpdateProfile(ctx context.Context, personaID int, req models.UpdateProfileRequest) (*models.ProfileResponse, error) {
	req.Nombre = strings.TrimSpace(req.Nombre)
	req.PrimerApellido = strings.TrimSpace(req.PrimerApellido)
	req.Sexo = strings.ToLower(strings.TrimSpace(req.Sexo))
	req.Telefono = strings.TrimSpace(req.Telefono)
	req.CI = strings.TrimSpace(req.CI)

	if req.SegundoApellido != nil {
		if trimmed := strings.TrimSpace(*req.SegundoApellido); trimmed != "" {
			req.SegundoApellido = &trimmed
		} else {
			req.SegundoApellido = nil
		}
	}

	if req.Nacimiento != nil {
		if trimmed := strings.TrimSpace(*req.Nacimiento); trimmed != "" {
			if _, err := time.Parse("2006-01-02", trimmed); err != nil {
				return nil, errors.New("fecha de nacimiento inválida, se espera yyyy-mm-dd")
			}
			req.Nacimiento = &trimmed
		} else {
			req.Nacimiento = nil
		}
	}

	if req.Nombre == "" || req.PrimerApellido == "" {
		return nil, errors.New("nombre y primer apellido son requeridos")
	}
	if len(req.Nombre) > 255 || len(req.PrimerApellido) > 255 {
		return nil, errors.New("nombre o primer apellido demasiado largo")
	}
	if len(req.Telefono) > 50 {
		return nil, errors.New("teléfono demasiado largo")
	}
	if len(req.CI) > 50 {
		return nil, errors.New("CI demasiado largo")
	}
	if len(req.Sexo) > 20 {
		return nil, errors.New("sexo inválido")
	}

	user, err := s.repo.UpdatePersona(ctx, personaID, req)
	if err != nil {
		return nil, err
	}
	return user.ToProfile(), nil
}

type Claims struct {
	Role      string `json:"role"`
	PersonaID *int   `json:"persona_id"`
	jwt.RegisteredClaims
}

func (s *AuthService) generateToken(user *models.User) (*models.TokenResponse, error) {
	expiresAt := time.Now().Add(s.cfg.JWTExpiration)

	claims := &Claims{
		Role:      user.Role,
		PersonaID: user.PersonaID,
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
