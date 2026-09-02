package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/pkg/response"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/especialidad/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/especialidad/services"
)

type EspecialidadHandler struct {
	svc *services.EspecialidadService
}

func NewEspecialidadHandler(svc *services.EspecialidadService) *EspecialidadHandler {
	return &EspecialidadHandler{svc: svc}
}

func (h *EspecialidadHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	especialidades, err := h.svc.GetAll(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, especialidades)
}

func (h *EspecialidadHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	especialidad, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, especialidad)
}

func (h *EspecialidadHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateEspecialidadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	if req.Nombre == "" || req.Codigo == "" {
		response.Error(w, http.StatusBadRequest, "nombre y código son requeridos")
		return
	}

	especialidad, err := h.svc.Create(r.Context(), req)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusCreated, especialidad)
}

func (h *EspecialidadHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	var req models.UpdateEspecialidadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	especialidad, err := h.svc.Update(r.Context(), id, req)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, especialidad)
}

func (h *EspecialidadHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	if err := h.svc.Delete(r.Context(), id); err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "especialidad eliminada"})
}