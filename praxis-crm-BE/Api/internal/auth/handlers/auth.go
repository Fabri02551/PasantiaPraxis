package handlers

import (
	"encoding/json"
	"net/http"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/services"
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
