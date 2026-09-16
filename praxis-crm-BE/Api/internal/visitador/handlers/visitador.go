package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/pkg/response"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visitador/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visitador/services"
)

type VisitadorHandler struct {
	svc *services.VisitadorService
}

func NewVisitadorHandler(svc *services.VisitadorService) *VisitadorHandler {
	return &VisitadorHandler{svc: svc}
}

func (h *VisitadorHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateVisitadorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	if req.Nombre == "" || req.PrimerApellido == "" {
		response.Error(w, http.StatusBadRequest, "nombre y primer apellido son requeridos")
		return
	}

	v := &models.Visitador{
		Nombre:          req.Nombre,
		PrimerApellido:  req.PrimerApellido,
		SegundoApellido: req.SegundoApellido,
		Sexo:            req.Sexo,
		Correo:          req.Correo,
		Telefono:        req.Telefono,
		CI:              req.CI,
		Activo:          true,
	}

	if err := h.svc.Create(r.Context(), v); err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, v)
}

func (h *VisitadorHandler) List(w http.ResponseWriter, r *http.Request) {
	visitadores, err := h.svc.List(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, visitadores)
}

func (h *VisitadorHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/visitadores/")
	if idStr == "" {
		response.Error(w, http.StatusBadRequest, "id requerido")
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id debe ser numérico")
		return
	}

	v, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusNotFound, "visitador no encontrado")
		return
	}

	response.JSON(w, http.StatusOK, v)
}

func (h *VisitadorHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/visitadores/")
	if idStr == "" {
		response.Error(w, http.StatusBadRequest, "id requerido")
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id debe ser numérico")
		return
	}

	var req models.UpdateVisitadorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	if err := h.svc.Update(r.Context(), id, &req); err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "actualizado"})
}

func (h *VisitadorHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/visitadores/")
	if idStr == "" {
		response.Error(w, http.StatusBadRequest, "id requerido")
		return
	}

	id, err := strconv.Atoi(idStr)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id debe ser numérico")
		return
	}

	if err := h.svc.Delete(r.Context(), id); err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "eliminado"})
}
