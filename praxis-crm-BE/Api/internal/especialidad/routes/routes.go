package routes

import (
	"net/http"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/especialidad/handlers"
)

func Register(mux *http.ServeMux, h *handlers.EspecialidadHandler, authSecret string) {
	auth := middleware.Auth(authSecret)
	adminOnly := middleware.RequireRole("admin")

	mux.Handle("GET /api/especialidades", http.HandlerFunc(h.GetAll))
	mux.Handle("GET /api/especialidades/{id}", http.HandlerFunc(h.GetByID))
	mux.Handle("POST /api/especialidades", auth(adminOnly(http.HandlerFunc(h.Create))))
	mux.Handle("PUT /api/especialidades/{id}", auth(adminOnly(http.HandlerFunc(h.Update))))
	mux.Handle("DELETE /api/especialidades/{id}", auth(adminOnly(http.HandlerFunc(h.Delete))))
}