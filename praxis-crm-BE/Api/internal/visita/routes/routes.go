package routes

import (
	"net/http"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visita/handlers"
)

func Register(mux *http.ServeMux, h *handlers.VisitaHandler, authSecret string) {
	auth := middleware.Auth(authSecret)
	adminOnly := middleware.RequireRole("admin")
	visitadorOrAdmin := middleware.RequireRole("admin", "visitador")

	mux.Handle("GET /api/visitas", auth(http.HandlerFunc(h.GetAll)))
	mux.Handle("GET /api/visitas/{id}", auth(http.HandlerFunc(h.GetByID)))

	// Admin programa la visita (médico + fecha tentativa)
	mux.Handle("POST /api/visitas", auth(adminOnly(http.HandlerFunc(h.Create))))
	mux.Handle("PUT /api/visitas/{id}", auth(adminOnly(http.HandlerFunc(h.Update))))
	mux.Handle("DELETE /api/visitas/{id}", auth(adminOnly(http.HandlerFunc(h.Delete))))

	// Visitador registra la visita real
	mux.Handle("POST /api/visitas/{id}/registrar", auth(visitadorOrAdmin(http.HandlerFunc(h.Registrar))))

	// Estudios (laboratorios) de la visita
	mux.Handle("GET /api/visitas/{id}/laboratorios", auth(http.HandlerFunc(h.GetLaboratorios)))
	mux.Handle("POST /api/visitas/{id}/laboratorios", auth(visitadorOrAdmin(http.HandlerFunc(h.AddLaboratorios))))
	mux.Handle("DELETE /api/visitas/{id}/laboratorios/{laboratorio_id}", auth(visitadorOrAdmin(http.HandlerFunc(h.RemoveLaboratorio))))
}