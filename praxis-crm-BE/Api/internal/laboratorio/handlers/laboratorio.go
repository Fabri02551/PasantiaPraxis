package handlers

import (
	"net/http"
	"strconv"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/pkg/response"
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