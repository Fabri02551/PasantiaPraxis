package handlers

import (
	"encoding/json"
	"net/http"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/services"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/pkg/response"
)

type PasswordResetHandler struct {
	svc *services.PasswordResetService
}

func NewPasswordResetHandler(svc *services.PasswordResetService) *PasswordResetHandler {
	return &PasswordResetHandler{svc: svc}
}

func (h *PasswordResetHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req models.ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}
	if err := h.svc.ForgotPassword(r.Context(), req); err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "si el correo existe, se envió un enlace de recuperación"})
}

func (h *PasswordResetHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req models.ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}
	if err := h.svc.ResetPassword(r.Context(), req); err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "contraseña actualizada correctamente"})
}
