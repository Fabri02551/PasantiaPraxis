package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/pkg/response"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visita/models"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visita/services"
)

type VisitaHandler struct {
	svc *services.VisitaService
}

func NewVisitaHandler(svc *services.VisitaService) *VisitaHandler {
	return &VisitaHandler{svc: svc}
}

func (h *VisitaHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	visitas, err := h.svc.GetAll(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, visitas)
}

func (h *VisitaHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	visita, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, visita)
}

// Create: programa la visita con el médico o institución y la fecha tentativa.
// Si quien crea es un visitador, la visita se fuerza para él mismo (su
// persona_id del token), protegiendo contra crear visitas para otro usuario.
//
// Una visita extraordinaria se crea SIN fecha tentativa: se registra en campo
// de inmediato. Por eso la fecha solo es obligatoria para las programadas.
func (h *VisitaHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateVisitaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	role, _ := r.Context().Value(middleware.RoleKey).(string)
	if role == "visitador" {
		pid := middleware.UserPersonaID(r.Context())
		if pid == nil {
			response.Error(w, http.StatusUnauthorized, "token sin persona_id")
			return
		}
		req.IDVisitador = *pid
	}

	if req.IDVisitador == 0 {
		response.Error(w, http.StatusBadRequest, "id_visitador es requerido")
		return
	}
	if req.IDMedico == nil && req.InstitucionID == nil {
		response.Error(w, http.StatusBadRequest, "id_medico o institucion_id son requeridos")
		return
	}
	if !req.Extraordinaria && req.FechaVisitaTentativa == nil {
		response.Error(w, http.StatusBadRequest, "fecha_visita_tentativa es requerida")
		return
	}

	visita, err := h.svc.Create(r.Context(), req)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusCreated, visita)
}

func (h *VisitaHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	var req models.UpdateVisitaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}

	visita, err := h.svc.Update(r.Context(), id, req)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, visita)
}

// Registrar: el visitador llena la visita real (todo menos la tentativa).
//
// El GPS del visitador es opcional a propósito: si deniega el permiso, la
// visita se registra igual y el service la marca con sin_evidencia_ubicacion.
// Bloquear el registro dejaría al visitador sin poder trabajar en terreno sin
// cobertura. Lo que sí es inválido es media coordenada: sin par no hay nada
// que auditar.
func (h *VisitaHandler) Registrar(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	var req models.RegistrarVisitaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}
	if (req.Latitud == nil) != (req.Longitud == nil) {
		response.Error(w, http.StatusBadRequest, "latitud y longitud deben ir juntas")
		return
	}
	if (req.DestinoLatitud == nil) != (req.DestinoLongitud == nil) {
		response.Error(w, http.StatusBadRequest, "destino_latitud y destino_longitud deben ir juntas")
		return
	}

	visita, err := h.svc.Registrar(r.Context(), id, req)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, visita)
}

func (h *VisitaHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	if err := h.svc.Delete(r.Context(), id); err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "visita eliminada"})
}

func (h *VisitaHandler) GetLaboratorios(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	labs, err := h.svc.GetLaboratorios(r.Context(), id)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, labs)
}

func (h *VisitaHandler) AddLaboratorios(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	var req models.AddLaboratoriosRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "json inválido")
		return
	}
	if len(req.Laboratorios) == 0 {
		response.Error(w, http.StatusBadRequest, "laboratorios es requerido")
		return
	}
	for _, it := range req.Laboratorios {
		if it.LaboratorioID == 0 {
			response.Error(w, http.StatusBadRequest, "laboratorio_id inválido")
			return
		}
		if it.Cantidad < 1 {
			response.Error(w, http.StatusBadRequest, "cantidad debe ser mayor a 0")
			return
		}
	}

	labs, err := h.svc.AddLaboratorios(r.Context(), id, req)
	if err != nil {
		response.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, labs)
}

func (h *VisitaHandler) RemoveLaboratorio(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "id inválido")
		return
	}

	labID, err := strconv.Atoi(r.PathValue("laboratorio_id"))
	if err != nil {
		response.Error(w, http.StatusBadRequest, "laboratorio_id inválido")
		return
	}

	labs, err := h.svc.RemoveLaboratorio(r.Context(), id, labID)
	if err != nil {
		response.Error(w, http.StatusNotFound, err.Error())
		return
	}
	response.JSON(w, http.StatusOK, labs)
}
