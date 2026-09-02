package routes

import (
	"net/http"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/persona/handlers"
)

func Register(mux *http.ServeMux, h *handlers.PersonaHandler, authSecret string) {
	auth := middleware.Auth(authSecret)
	adminOnly := middleware.RequireRole("admin")

	mux.Handle("GET /api/personas", http.HandlerFunc(h.GetAll))
	mux.Handle("GET /api/personas/{id}", http.HandlerFunc(h.GetByID))
	mux.Handle("POST /api/personas", auth(adminOnly(http.HandlerFunc(h.Create))))
	mux.Handle("PUT /api/personas/{id}", auth(adminOnly(http.HandlerFunc(h.Update))))
	mux.Handle("DELETE /api/personas/{id}", auth(adminOnly(http.HandlerFunc(h.Delete))))
}