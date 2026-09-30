package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/pkg/response"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/medico/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/medico/services"
)

func isDuplicateKey(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "duplicate key")
}

func isForeignKeyViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "foreign key") || strings.Contains(msg, "violates foreign key constraint")
}

type MedicoHandler struct {
	svc *services.MedicoService
}

func NewMedicoHandler(svc *services.MedicoService) *MedicoHandler {
	return &MedicoHandler{svc: svc}
}

func (h *MedicoHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	medicos, err := h.svc.GetAll(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, medicos)
}

func (h *MedicoHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	personaID, err := strconv.Atoi(r.PathValue("persona_id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "persona_id inválido")
		return
	}

	medico, err := h.svc.GetByID(r.Context(), personaID)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, medico)
}

func (h *MedicoHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateMedicoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	// Todas las validaciones ocurren ANTES de tocar la base de datos, para no
	// dejar registros a medias cuando el alta viene anidada en una transacción.
	if req.Matricula == "" {
		response.Error(w, http.StatusBadRequest, "matricula es requerida")
		return
	}
	if req.EspecialidadID == 0 {
		response.Error(w, http.StatusBadRequest, "especialidad_id es requerido")
		return
	}

	// Camino atómico: la persona viene anidada, se inserta junto al médico.
	if req.Persona != nil {
		p := req.Persona
		if p.Nombre == "" || p.PrimerApellido == "" {
			response.Error(w, http.StatusBadRequest, "nombre y primer_apellido son requeridos")
			return
		}
		if p.Sexo == "" {
			response.Error(w, http.StatusBadRequest, "sexo es requerido")
			return
		}
		medico, err := h.svc.CreateCompleto(r.Context(), middleware.UserPersonaID(r.Context()), middleware.UserRole(r.Context()), *p, req)
		if err != nil {
			if isDuplicateKey(err) {
				response.Error(w, http.StatusConflict, "matricula, código o persona ya registrados")
				return
			}
			if isForeignKeyViolation(err) {
				response.Error(w, http.StatusBadRequest, "la especialidad indicada no existe")
				return
			}
			response.Error(w, http.StatusInternalServerError, err.Error())
			return
		}
		response.JSON(w, http.StatusCreated, medico)
		return
	}

	sexo, err := h.svc.GetPersonaSexo(r.Context(), req.PersonaID)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if sexo == "" {
		response.Error(w, http.StatusBadRequest, "la persona del médico debe tener sexo definido")
		return
	}

	medico, err := h.svc.Create(r.Context(), middleware.UserPersonaID(r.Context()), middleware.UserRole(r.Context()), req)
	if err != nil {
		if isDuplicateKey(err) {
			response.Error(w, http.StatusConflict, "matricula, código o persona ya registrados")
			return
		}
		if isForeignKeyViolation(err) {
			response.Error(w, http.StatusBadRequest, "la especialidad indicada no existe")
			return
		}
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusCreated, medico)
}

func (h *MedicoHandler) Update(w http.ResponseWriter, r *http.Request) {
	personaID, err := strconv.Atoi(r.PathValue("persona_id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "persona_id inválido")
		return
	}

	var req models.UpdateMedicoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	medico, err := h.svc.Update(r.Context(), middleware.UserPersonaID(r.Context()), personaID, req)
	if err != nil {
		if isDuplicateKey(err) {
			response.Error(w, http.StatusConflict, "matricula, código o persona ya registrados")
			return
		}
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, medico)
}

func (h *MedicoHandler) Delete(w http.ResponseWriter, r *http.Request) {
	personaID, err := strconv.Atoi(r.PathValue("persona_id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "persona_id inválido")
		return
	}

	if err := h.svc.Delete(r.Context(), middleware.UserPersonaID(r.Context()), personaID); err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "médico eliminado"})
}
