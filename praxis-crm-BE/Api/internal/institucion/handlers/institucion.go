package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/pkg/response"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/institucion/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/institucion/services"
)

type InstitucionHandler struct {
	svc *services.InstitucionService
}

func NewInstitucionHandler(svc *services.InstitucionService) *InstitucionHandler {
	return &InstitucionHandler{svc: svc}
}

func (h *InstitucionHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.GetAll(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, items)
}

func (h *InstitucionHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	item, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, item)
}

func (h *InstitucionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateInstitucionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	if req.Nombre == "" {
		response.Error(w, http.StatusBadRequest, "nombre es requerido")
		return
	}

	item, err := h.svc.Create(r.Context(), middleware.UserPersonaID(r.Context()), middleware.UserRole(r.Context()), req)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate key") {
			response.Error(w, http.StatusConflict, "nit ya existe")
			return
		}
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusCreated, item)
}

func (h *InstitucionHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	var req models.UpdateInstitucionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	item, err := h.svc.Update(r.Context(), middleware.UserPersonaID(r.Context()), id, req)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, item)
}

func (h *InstitucionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	if err := h.svc.Delete(r.Context(), middleware.UserPersonaID(r.Context()), id); err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "institución eliminada"})
}