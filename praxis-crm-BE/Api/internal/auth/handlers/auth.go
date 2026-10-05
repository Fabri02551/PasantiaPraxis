package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/services"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/pkg/response"
)

type AuthHandler struct {
	svc *services.AuthService
}

func NewAuthHandler(svc *services.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	if req.Email == "" || req.Password == "" {
		response.Error(w, http.StatusBadRequest, "email y password son requeridos")
		return
	}

	token, err := h.svc.Login(r.Context(), req)
	if err != nil {
		response.Error(w, http.StatusUnauthorized, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, token)
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	if req.Email == "" || req.Password == "" {
		response.Error(w, http.StatusBadRequest, "email y password son requeridos")
		return
	}

	token, err := h.svc.Register(r.Context(), req)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, token)
}

// personaIDExtrae el persona_id del token. Tokens emitidos antes de que el
// claim `persona_id` existiera no lo traen, y sin él no se puede resolver
// el perfil, así que se responde 401 en vez de 500.
func personaIDFrom(w http.ResponseWriter, r *http.Request) (int, bool) {
	id := middleware.UserPersonaID(r.Context())
	if id == nil {
		response.Error(w, http.StatusUnauthorized, "el token no tiene persona asociada, vuelve a iniciar sesión")
		return 0, false
	}
	return *id, true
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	personaID, ok := personaIDFrom(w, r)
	if !ok {
		return
	}

	profile, err := h.svc.GetProfile(r.Context(), personaID)
	if err != nil {
		response.Error(w, http.StatusNotFound, "perfil no encontrado")
		return
	}

	response.JSON(w, http.StatusOK, profile)
}

func (h *AuthHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	personaID, ok := personaIDFrom(w, r)
	if !ok {
		return
	}

	var req models.UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	profile, err := h.svc.UpdateProfile(r.Context(), personaID, req)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, profile)
}

// ChangePassword cambia la contraseña de quien está autenticado.
func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	personaID, ok := personaIDFrom(w, r)
	if !ok {
		return
	}

	var req models.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	if err := h.svc.ChangePassword(r.Context(), personaID, req); err != nil {
		// 401 solo cuando la actual no es correcta: así el frontend puede
		// distinguir "te equivocaste" de "la nueva no cumple la regla".
		if strings.Contains(err.Error(), "actual no es correcta") {
			response.Error(w, http.StatusUnauthorized, err.Error())
			return
		}
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "contraseña actualizada"})
}
