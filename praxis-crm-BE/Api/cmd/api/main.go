package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	accionhandlers "gitlab.com/labpraxis/praxis-crm-be/api/internal/accion/handlers"
	accionrepo "gitlab.com/labpraxis/praxis-crm-be/api/internal/accion/repository"
	accionroutes "gitlab.com/labpraxis/praxis-crm-be/api/internal/accion/routes"
	accionsvc "gitlab.com/labpraxis/praxis-crm-be/api/internal/accion/services"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/handlers"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/repository"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/routes"
	authsvc "gitlab.com/labpraxis/praxis-crm-be/api/internal/auth/services"
	ciudadhandlers "gitlab.com/labpraxis/praxis-crm-be/api/internal/ciudad/handlers"
	ciudadrepo "gitlab.com/labpraxis/praxis-crm-be/api/internal/ciudad/repository"
	ciudadroutes "gitlab.com/labpraxis/praxis-crm-be/api/internal/ciudad/routes"
	ciudadsvc "gitlab.com/labpraxis/praxis-crm-be/api/internal/ciudad/services"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/config"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/database"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/email"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/core/middleware"
	especialidadhandlers "gitlab.com/labpraxis/praxis-crm-be/api/internal/especialidad/handlers"
	especialidadrepo "gitlab.com/labpraxis/praxis-crm-be/api/internal/especialidad/repository"
	especialidadroutes "gitlab.com/labpraxis/praxis-crm-be/api/internal/especialidad/routes"
	especialidadsvc "gitlab.com/labpraxis/praxis-crm-be/api/internal/especialidad/services"
	institucionhandlers "gitlab.com/labpraxis/praxis-crm-be/api/internal/institucion/handlers"
	institucionrepo "gitlab.com/labpraxis/praxis-crm-be/api/internal/institucion/repository"
	institucionroutes "gitlab.com/labpraxis/praxis-crm-be/api/internal/institucion/routes"
	institucionsvc "gitlab.com/labpraxis/praxis-crm-be/api/internal/institucion/services"
	laboratoriohandlers "gitlab.com/labpraxis/praxis-crm-be/api/internal/laboratorio/handlers"
	laboratoriorepo "gitlab.com/labpraxis/praxis-crm-be/api/internal/laboratorio/repository"
	laboratorioroutes "gitlab.com/labpraxis/praxis-crm-be/api/internal/laboratorio/routes"
	laboratoriosvc "gitlab.com/labpraxis/praxis-crm-be/api/internal/laboratorio/services"
	medicohandlers "gitlab.com/labpraxis/praxis-crm-be/api/internal/medico/handlers"
	medicorepo "gitlab.com/labpraxis/praxis-crm-be/api/internal/medico/repository"
	medicoroutes "gitlab.com/labpraxis/praxis-crm-be/api/internal/medico/routes"
	medicosvc "gitlab.com/labpraxis/praxis-crm-be/api/internal/medico/services"
	personahandlers "gitlab.com/labpraxis/praxis-crm-be/api/internal/persona/handlers"
	personarepo "gitlab.com/labpraxis/praxis-crm-be/api/internal/persona/repository"
	personaroutes "gitlab.com/labpraxis/praxis-crm-be/api/internal/persona/routes"
	personasvc "gitlab.com/labpraxis/praxis-crm-be/api/internal/persona/services"
	vhandlers "gitlab.com/labpraxis/praxis-crm-be/api/internal/visitador/handlers"
	vrepo "gitlab.com/labpraxis/praxis-crm-be/api/internal/visitador/repository"
	vroutes "gitlab.com/labpraxis/praxis-crm-be/api/internal/visitador/routes"
	vsvc "gitlab.com/labpraxis/praxis-crm-be/api/internal/visitador/services"
	visitalhandlers "gitlab.com/labpraxis/praxis-crm-be/api/internal/visita/handlers"
	visitalrepo "gitlab.com/labpraxis/praxis-crm-be/api/internal/visita/repository"
	visitaroutes "gitlab.com/labpraxis/praxis-crm-be/api/internal/visita/routes"
	visitasvc "gitlab.com/labpraxis/praxis-crm-be/api/internal/visita/services"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("error conectando a la base de datos: %v", err)
	}
	defer pool.Close()

	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Auth module
	authRepo := repository.NewAuthRepository(pool)
	authSvc := authsvc.NewAuthService(authRepo, cfg)
	authHandler := handlers.NewAuthHandler(authSvc)
	resetRepo := repository.NewPasswordResetRepository(pool)
	emailSvc := email.New(cfg)
	resetSvc := authsvc.NewPasswordResetService(resetRepo, authRepo, emailSvc, cfg)
	resetHandler := handlers.NewPasswordResetHandler(resetSvc)
	routes.Register(mux, authHandler, resetHandler, cfg.JWTSecret)

	// Ciudad module
	ciudadRepo := ciudadrepo.NewCiudadRepository(pool)
	ciudadSvc := ciudadsvc.NewCiudadService(ciudadRepo)
	ciudadHandler := ciudadhandlers.NewCiudadHandler(ciudadSvc)
	ciudadroutes.Register(mux, ciudadHandler, cfg.JWTSecret)

	// Especialidad module
	especialidadRepo := especialidadrepo.NewEspecialidadRepository(pool)
	especialidadSvc := especialidadsvc.NewEspecialidadService(especialidadRepo)
	especialidadHandler := especialidadhandlers.NewEspecialidadHandler(especialidadSvc)
	especialidadroutes.Register(mux, especialidadHandler, cfg.JWTSecret)

	// Persona module
	personaRepo := personarepo.NewPersonaRepository(pool)
	personaSvc := personasvc.NewPersonaService(personaRepo)
	personaHandler := personahandlers.NewPersonaHandler(personaSvc)
	personaroutes.Register(mux, personaHandler, cfg.JWTSecret)

	// Medico module
	medicoRepo := medicorepo.NewMedicoRepository(pool)
	medicoSvc := medicosvc.NewMedicoService(medicoRepo)
	medicoHandler := medicohandlers.NewMedicoHandler(medicoSvc)
	medicoroutes.Register(mux, medicoHandler, cfg.JWTSecret)

	// Accion module
	accionRepo := accionrepo.NewAccionRepository(pool)
	accionSvc := accionsvc.NewAccionService(accionRepo)
	accionHandler := accionhandlers.NewAccionHandler(accionSvc)
	accionroutes.Register(mux, accionHandler, cfg.JWTSecret)

	// Laboratorio module
	laboratorioRepo := laboratoriorepo.NewLaboratorioRepository(pool)
	laboratorioSvc := laboratoriosvc.NewLaboratorioService(laboratorioRepo)
	laboratorioHandler := laboratoriohandlers.NewLaboratorioHandler(laboratorioSvc)
	laboratorioroutes.Register(mux, laboratorioHandler, cfg.JWTSecret)

	// Institucion module
	institucionRepo := institucionrepo.NewInstitucionRepository(pool)
	institucionSvc := institucionsvc.NewInstitucionService(institucionRepo)
	institucionHandler := institucionhandlers.NewInstitucionHandler(institucionSvc)
	institucionroutes.Register(mux, institucionHandler, cfg.JWTSecret)

	// Visitador module
	visitadorRepo := vrepo.NewVisitadorRepository(pool)
	visitadorSvc := vsvc.NewVisitadorService(visitadorRepo)
	visitadorHandler := vhandlers.NewVisitadorHandler(visitadorSvc)
	vroutes.Register(mux, visitadorHandler, cfg.JWTSecret)

	// Visita module
	visitaRepo := visitalrepo.NewVisitaRepository(pool)
	visitaSvc := visitasvc.NewVisitaService(visitaRepo)
	visitaHandler := visitalhandlers.NewVisitaHandler(visitaSvc)
	visitaroutes.Register(mux, visitaHandler, cfg.JWTSecret)

	handler := middleware.CORS(mux)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("API escuchando en el puerto %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("error al iniciar el servidor: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("apagado forzado: %v", err)
	}
}
