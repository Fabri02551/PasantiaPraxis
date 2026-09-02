package routes

import (
	"net/http"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/accion/handlers"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
)

func Register(mux *http.ServeMux, h *handlers.AccionHandler, authSecret string) {
	auth := middleware.Auth(authSecret)
	adminOnly := middleware.RequireRole("admin")

	mux.Handle("GET /api/acciones", http.HandlerFunc(h.GetAll))
	mux.Handle("GET /api/acciones/{id}", http.HandlerFunc(h.GetByID))
	mux.Handle("POST /api/acciones", auth(adminOnly(http.HandlerFunc(h.Create))))
	mux.Handle("PUT /api/acciones/{id}", auth(adminOnly(http.HandlerFunc(h.Update))))
	mux.Handle("DELETE /api/acciones/{id}", auth(adminOnly(http.HandlerFunc(h.Delete))))
}