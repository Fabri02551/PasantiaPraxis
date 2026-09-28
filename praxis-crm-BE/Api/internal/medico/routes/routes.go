package routes

import (
	"net/http"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/medico/handlers"
)

func Register(mux *http.ServeMux, h *handlers.MedicoHandler, authSecret string) {
	auth := middleware.Auth(authSecret)
	adminOnly := middleware.RequireRole("admin")
	medicoWrite := middleware.RequireRole("admin", "visitador")

	mux.Handle("GET /api/medicos", http.HandlerFunc(h.GetAll))
	mux.Handle("GET /api/medicos/{persona_id}", http.HandlerFunc(h.GetByID))
	mux.Handle("POST /api/medicos", auth(medicoWrite(http.HandlerFunc(h.Create))))
	mux.Handle("PUT /api/medicos/{persona_id}", auth(adminOnly(http.HandlerFunc(h.Update))))
	mux.Handle("DELETE /api/medicos/{persona_id}", auth(adminOnly(http.HandlerFunc(h.Delete))))
}
