package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/ciudad/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/ciudad/services"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/pkg/response"
)

type CiudadHandler struct {
	svc *services.CiudadService
}

func NewCiudadHandler(svc *services.CiudadService) *CiudadHandler {
	return &CiudadHandler{svc: svc}
}

func (h *CiudadHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	ciudades, err := h.svc.GetAll(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, ciudades)
}

func (h *CiudadHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	ciudad, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, ciudad)
}

func (h *CiudadHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateCiudadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	if req.Nombre == "" {
		response.Error(w, http.StatusBadRequest, "nombre es requerido")
		return
	}

	ciudad, err := h.svc.Create(r.Context(), req)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusCreated, ciudad)
}

func (h *CiudadHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	var req models.UpdateCiudadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	ciudad, err := h.svc.Update(r.Context(), id, req)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, ciudad)
}

func (h *CiudadHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	if err := h.svc.Delete(r.Context(), id); err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "ciudad eliminada"})
}