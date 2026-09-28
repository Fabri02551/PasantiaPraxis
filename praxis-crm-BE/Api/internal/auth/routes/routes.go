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
}
