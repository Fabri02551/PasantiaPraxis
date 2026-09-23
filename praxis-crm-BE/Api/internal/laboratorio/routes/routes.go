package routes

import (
	"net/http"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/laboratorio/handlers"
)

func Register(mux *http.ServeMux, h *handlers.LaboratorioHandler) {
	mux.Handle("GET /api/laboratorios", http.HandlerFunc(h.GetAll))
	mux.Handle("GET /api/laboratorios/{id}", http.HandlerFunc(h.GetByID))
}