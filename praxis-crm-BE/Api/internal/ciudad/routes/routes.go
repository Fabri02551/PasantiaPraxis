package routes

import (
	"net/http"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/ciudad/handlers"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
)

func Register(mux *http.ServeMux, h *handlers.CiudadHandler, authSecret string) {
	auth := middleware.Auth(authSecret)
	adminOnly := middleware.RequireRole("admin")

	mux.Handle("GET /api/ciudades", http.HandlerFunc(h.GetAll))
	mux.Handle("GET /api/ciudades/{id}", http.HandlerFunc(h.GetByID))
	mux.Handle("POST /api/ciudades", auth(adminOnly(http.HandlerFunc(h.Create))))
	mux.Handle("PUT /api/ciudades/{id}", auth(adminOnly(http.HandlerFunc(h.Update))))
	mux.Handle("DELETE /api/ciudades/{id}", auth(adminOnly(http.HandlerFunc(h.Delete))))
}