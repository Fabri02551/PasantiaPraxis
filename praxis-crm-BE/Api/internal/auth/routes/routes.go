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
	// Cambio de contraseña del usuario autenticado (persona_id del token).
	mux.Handle("PUT /api/auth/password",
		middleware.Auth(authSecret)(http.HandlerFunc(h.ChangePassword)))
}
