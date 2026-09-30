package routes

import (
	"net/http"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/institucion/handlers"
)

func Register(mux *http.ServeMux, h *handlers.InstitucionHandler, authSecret string) {
	auth := middleware.Auth(authSecret)
	adminOnly := middleware.RequireRole("admin")
	// El visitador necesita leer su cartera de instituciones y puede crear:
	// el alta en campo es del propio visitador (se le auto-asigna como
	// visitador_id). La edición y eliminación siguen siendo exclusivas de admin.
	getVisible := middleware.RequireRole("admin", "visitador")
	createVisible := middleware.RequireRole("admin", "visitador")

	allRoutes := func(fn http.HandlerFunc) http.Handler {
		return auth(adminOnly(http.HandlerFunc(fn)))
	}
	readRoutes := func(fn http.HandlerFunc) http.Handler {
		return auth(getVisible(http.HandlerFunc(fn)))
	}
	createRoutes := func(fn http.HandlerFunc) http.Handler {
		return auth(createVisible(http.HandlerFunc(fn)))
	}

	mux.Handle("GET /api/instituciones", readRoutes(h.GetAll))
	mux.Handle("GET /api/instituciones/{id}", readRoutes(h.GetByID))
	mux.Handle("POST /api/instituciones", createRoutes(h.Create))
	mux.Handle("PUT /api/instituciones/{id}", allRoutes(h.Update))
	mux.Handle("DELETE /api/instituciones/{id}", allRoutes(h.Delete))
}