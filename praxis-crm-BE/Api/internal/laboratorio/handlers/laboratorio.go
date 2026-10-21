package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/pkg/response"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/laboratorio/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/laboratorio/services"
)

type LaboratorioHandler struct {
	svc *services.LaboratorioService
}

func NewLaboratorioHandler(svc *services.LaboratorioService) *LaboratorioHandler {
	return &LaboratorioHandler{svc: svc}
}

func (h *LaboratorioHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	labs, err := h.svc.GetAll(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, labs)
}

func (h *LaboratorioHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	lab, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, lab)
}

// Precios consume la cotización del visitador: lista los estudios con su costo
// según ?ciudad_id (optativo). GET /api/laboratorios/precios?ciudad_id=N
func (h *LaboratorioHandler) Precios(w http.ResponseWriter, r *http.Request) {
	var ciudadID *int
	if v := r.URL.Query().Get("ciudad_id"); v != "" {
		id, err := strconv.Atoi(v)
		if err != nil {
			response.Error(w, http.StatusBadRequest, "ciudad_id inválido")
			return
		}
		ciudadID = &id
	}

	items, err := h.svc.GetPreciosPorCiudad(r.Context(), ciudadID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, items)
}

func (h *LaboratorioHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateLaboratorioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	if req.Nombre == "" {
		response.Error(w, http.StatusBadRequest, "nombre es requerido")
		return
	}
	if req.Area == "" {
		response.Error(w, http.StatusBadRequest, "area es requerida")
		return
	}

	lab, err := h.svc.Create(r.Context(), middleware.UserPersonaID(r.Context()), req)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusCreated, lab)
}

func (h *LaboratorioHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	var req models.UpdateLaboratorioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	lab, err := h.svc.Update(r.Context(), middleware.UserPersonaID(r.Context()), id, req)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, lab)
}

func (h *LaboratorioHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	if err := h.svc.Delete(r.Context(), middleware.UserPersonaID(r.Context()), id); err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "laboratorio eliminado"})
}