package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/accion/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/accion/services"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/pkg/response"
)

type AccionHandler struct {
	svc *services.AccionService
}

func NewAccionHandler(svc *services.AccionService) *AccionHandler {
	return &AccionHandler{svc: svc}
}

func (h *AccionHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	acciones, err := h.svc.GetAll(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, acciones)
}

func (h *AccionHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	accion, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, accion)
}

func (h *AccionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateAccionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	if req.NombreAccion == "" {
		response.Error(w, http.StatusBadRequest, "nombre de acción es requerido")
		return
	}

	accion, err := h.svc.Create(r.Context(), req)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusCreated, accion)
}

func (h *AccionHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	var req models.UpdateAccionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	accion, err := h.svc.Update(r.Context(), id, req)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, accion)
}

func (h *AccionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	if err := h.svc.Delete(r.Context(), id); err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "acción eliminada"})
}