package routes

import (
	"net/http"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visita/handlers"
)

func Register(mux *http.ServeMux, h *handlers.VisitaHandler, authSecret string) {
	auth := middleware.Auth(authSecret)

	mux.Handle("GET /api/visitas", auth(http.HandlerFunc(h.GetAll)))
	mux.Handle("GET /api/visitas/{id}", auth(http.HandlerFunc(h.GetByID)))
	mux.Handle("POST /api/visitas", auth(http.HandlerFunc(h.Create)))
	mux.Handle("PUT /api/visitas/{id}", auth(http.HandlerFunc(h.Update)))
	mux.Handle("DELETE /api/visitas/{id}", auth(http.HandlerFunc(h.Delete)))
}