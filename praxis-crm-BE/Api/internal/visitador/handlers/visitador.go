package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
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

// createVisitadorResponse es el alta del visitador. PasswordGenerado solo
// aparece cuando no se pudo enviar el correo: es la única copia en claro de
// la contraseña que sale de la API, para que el administrador la reparta a
// mano. Si el correo salió bien, no está en la respuesta.
type createVisitadorResponse struct {
	models.Visitador
	PasswordGenerado string `json:"password_generado,omitempty"`
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
	if req.Sexo == "" {
		response.Error(w, http.StatusBadRequest, "sexo es requerido")
		return
	}
	// El correo es la dirección a la que llegan el usuario y la contraseña
	// generada: sin él no se puede crear la cuenta de acceso.
	if strings.TrimSpace(req.Correo) == "" {
		response.Error(w, http.StatusBadRequest, "el correo es requerido: ahi se envian el usuario y la contraseña")
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
		Latitud:         req.Latitud,
		Longitud:        req.Longitud,
		Activo:          true,
	}

	passwordGenerada, err := h.svc.Create(r.Context(), middleware.UserPersonaID(r.Context()), v)
	if err != nil {
		if errors.Is(err, models.ErrCorreoYaRegistrado) {
			response.Error(w, http.StatusConflict, err.Error())
			return
		}
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, createVisitadorResponse{Visitador: *v, PasswordGenerado: passwordGenerada})
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

	if err := h.svc.Update(r.Context(), middleware.UserPersonaID(r.Context()), id, &req); err != nil {
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
