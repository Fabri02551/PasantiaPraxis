package routes

import (
	"net/http"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/handlers"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
)

func Register(mux *http.ServeMux, h *handlers.AuthHandler, authSecret string) {
	mux.HandleFunc("POST /api/auth/login", h.Login)
	mux.Handle("POST /api/auth/register",
		middleware.Auth(authSecret)(middleware.RequireRole("admin")(http.HandlerFunc(h.Register))))
	// Perfil del usuario autenticado: el persona_id se toma del token.
	mux.Handle("GET /api/auth/me",
		middleware.Auth(authSecret)(http.HandlerFunc(h.Me)))
	mux.Handle("PUT /api/auth/me",
		middleware.Auth(authSecret)(http.HandlerFunc(h.UpdateMe)))

	// CRUD de administradores (solo rol admin): persona <-> users en
	// transacción, con eliminación lógica (persona.status 1 -> 0).
	adminOnly := func(next http.Handler) http.Handler {
		return middleware.Auth(authSecret)(middleware.RequireRole("admin")(next))
	}
	mux.Handle("GET /api/admins", adminOnly(http.HandlerFunc(h.ListAdmins)))
	mux.Handle("POST /api/admins", adminOnly(http.HandlerFunc(h.CreateAdmin)))
	mux.Handle("GET /api/admins/{persona_id}", adminOnly(http.HandlerFunc(h.GetAdmin)))
	mux.Handle("PUT /api/admins/{persona_id}", adminOnly(http.HandlerFunc(h.UpdateAdmin)))
	mux.Handle("DELETE /api/admins/{persona_id}", adminOnly(http.HandlerFunc(h.DeleteAdmin)))
}
