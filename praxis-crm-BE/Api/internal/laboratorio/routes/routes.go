package routes

import (
	"net/http"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/laboratorio/handlers"
)

// GET públicos (admin y visitador usan ambos): la lista y el detalle son de
// solo lectura; precios con ciudad para la cotización del visitador.
func Register(mux *http.ServeMux, h *handlers.LaboratorioHandler, authSecret string) {
	auth := middleware.Auth(authSecret)
	visitadorOrAdmin := middleware.RequireRole("admin", "visitador")

	mux.Handle("GET /api/laboratorios", http.HandlerFunc(h.GetAll))
	mux.Handle("GET /api/laboratorios/{id}", http.HandlerFunc(h.GetByID))
	mux.Handle("GET /api/laboratorios/precios", auth(visitadorOrAdmin(http.HandlerFunc(h.Precios))))
}