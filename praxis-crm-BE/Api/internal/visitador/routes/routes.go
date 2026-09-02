package routes

import (
	"net/http"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visitador/handlers"
)

func Register(mux *http.ServeMux, h *handlers.VisitadorHandler, jwtSecret string) {
	auth := middleware.Auth(jwtSecret)
	adminOnly := middleware.RequireRole("admin")

	wrap := func(fn http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			auth(adminOnly(http.HandlerFunc(fn))).ServeHTTP(w, r)
		}
	}

	mux.HandleFunc("GET /api/visitadores", wrap(h.List))
	mux.HandleFunc("POST /api/visitadores", wrap(h.Create))
	mux.HandleFunc("GET /api/visitadores/", wrap(h.GetByID))
	mux.HandleFunc("PUT /api/visitadores/", wrap(h.Update))
	mux.HandleFunc("DELETE /api/visitadores/", wrap(h.Delete))
}
