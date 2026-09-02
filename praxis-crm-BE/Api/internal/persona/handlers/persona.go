package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/pkg/response"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/persona/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/persona/services"
)

type PersonaHandler struct {
	svc *services.PersonaService
}

func NewPersonaHandler(svc *services.PersonaService) *PersonaHandler {
	return &PersonaHandler{svc: svc}
}

func (h *PersonaHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	personas, err := h.svc.GetAll(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, personas)
}

func (h *PersonaHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	persona, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, persona)
}

func (h *PersonaHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreatePersonaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	if req.Nombres == "" || req.Apellidos == "" {
		response.Error(w, http.StatusBadRequest, "nombres y apellidos son requeridos")
		return
	}

	persona, err := h.svc.Create(r.Context(), req)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusCreated, persona)
}

func (h *PersonaHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	var req models.UpdatePersonaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	persona, err := h.svc.Update(r.Context(), id, req)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, persona)
}

func (h *PersonaHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	if err := h.svc.Delete(r.Context(), id); err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "persona eliminada"})
}