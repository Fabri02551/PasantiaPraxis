package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visita/models"
)

type VisitaRepository struct {
	pool *pgxpool.Pool
}

func NewVisitaRepository(pool *pgxpool.Pool) *VisitaRepository {
	return &VisitaRepository{pool: pool}
}

// CalcularIngreso calcula el ingreso de una visita a partir de la ciudad
// del médico y si es particular (aplica la comisión). Usa el costo promedio
// de los estudios en la ciudad del médico; si es_particular, lo ajusta con
// la comisión extra promedio del laboratorio.
func (r *VisitaRepository) CalcularIngreso(ctx context.Context, idMedico int) (float64, error) {
	var ciudadID *int
	var esParticular bool
	err := r.pool.QueryRow(ctx, `
		SELECT p.ciudad_id, COALESCE(m.es_particular, false)
		FROM medico m
		JOIN persona p ON p.id = m.persona_id
		WHERE m.persona_id = $1`, idMedico,
	).Scan(&ciudadID, &esParticular)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, fmt.Errorf("médico no encontrado")
		}
		return 0, fmt.Errorf("consultando médico: %w", err)
	}
	if ciudadID == nil {
		return 0, nil
	}

	var costo float64
	err = r.pool.QueryRow(ctx, `
		SELECT AVG(lc.costo)
		FROM laboratorio_ciudad lc
		WHERE lc.ciudad_id = $1 AND lc.costo > 0`, *ciudadID,
	).Scan(&costo)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return 0, fmt.Errorf("consultando costos: %w", err)
	}

	if esParticular {
		var comision float64
		err = r.pool.QueryRow(ctx, `SELECT AVG(comision_extra) FROM laboratorio WHERE comision_extra > 0`).Scan(&comision)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return 0, fmt.Errorf("consultando comisión: %w", err)
		}
		costo = costo * (1 + comision)
	}
	return math.Round(costo*100) / 100, nil
}

func (r *VisitaRepository) GetAll(ctx context.Context) ([]models.Visita, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, id_visitador, id_medico, fecha_visita, fecha_visita_tentativa,
		        latitud, longitud, firma, observacion, satisfaccion, duracion, ingreso, papeleta
		 FROM visitador_medico ORDER BY fecha_visita DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var visitas []models.Visita
	for rows.Next() {
		var v models.Visita
		if err := rows.Scan(&v.ID, &v.IDVisitador, &v.IDMedico, &v.FechaVisita,
			&v.FechaVisitaTentativa, &v.Latitud, &v.Longitud, &v.Firma, &v.Observacion,
			&v.Satisfaccion, &v.Duracion, &v.Ingreso, &v.Papeleta); err != nil {
			return nil, err
		}
		visitas = append(visitas, v)
	}
	return visitas, nil
}

func (r *VisitaRepository) GetByID(ctx context.Context, id int) (*models.Visita, error) {
	var v models.Visita
	err := r.pool.QueryRow(ctx,
		`SELECT id, id_visitador, id_medico, fecha_visita, fecha_visita_tentativa,
		        latitud, longitud, firma, observacion, satisfaccion, duracion, ingreso, papeleta
		 FROM visitador_medico WHERE id = $1`, id,
	).Scan(&v.ID, &v.IDVisitador, &v.IDMedico, &v.FechaVisita,
		&v.FechaVisitaTentativa, &v.Latitud, &v.Longitud, &v.Firma, &v.Observacion,
		&v.Satisfaccion, &v.Duracion, &v.Ingreso, &v.Papeleta)
	if err != nil {
		return nil, fmt.Errorf("visita no encontrada")
	}
	return &v, nil
}

func (r *VisitaRepository) Create(ctx context.Context, req models.CreateVisitaRequest) (*models.Visita, error) {
	ingreso, err := r.CalcularIngreso(ctx, req.IDMedico)
	if err != nil {
		return nil, err
	}

	fecha := req.FechaVisita
	if fecha == nil {
		return nil, fmt.Errorf("fecha_visita es requerida")
	}

	var v models.Visita
	err = r.pool.QueryRow(ctx,
		`INSERT INTO visitador_medico (id_visitador, id_medico, fecha_visita, fecha_visita_tentativa,
		        latitud, longitud, firma, observacion, satisfaccion, duracion, ingreso, papeleta)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		 RETURNING id, id_visitador, id_medico, fecha_visita, fecha_visita_tentativa,
		        latitud, longitud, firma, observacion, satisfaccion, duracion, ingreso, papeleta`,
		req.IDVisitador, req.IDMedico, fecha, req.FechaVisitaTentativa,
		req.Latitud, req.Longitud, req.Firma, observacion(req.Observacion),
		req.Satisfaccion, req.Duracion, ingreso, req.Papeleta,
	).Scan(&v.ID, &v.IDVisitador, &v.IDMedico, &v.FechaVisita,
		&v.FechaVisitaTentativa, &v.Latitud, &v.Longitud, &v.Firma, &v.Observacion,
		&v.Satisfaccion, &v.Duracion, &v.Ingreso, &v.Papeleta)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (r *VisitaRepository) Update(ctx context.Context, id int, req models.UpdateVisitaRequest) (*models.Visita, error) {
	var v models.Visita
	err := r.pool.QueryRow(ctx,
		`UPDATE visitador_medico SET
		        fecha_visita = COALESCE($2, fecha_visita),
		        fecha_visita_tentativa = $3,
		        latitud = COALESCE($4, latitud),
		        longitud = COALESCE($5, longitud),
		        observacion = COALESCE($6, observacion),
		        satisfaccion = COALESCE($7, satisfaccion),
		        duracion = COALESCE($8, duracion),
		        papeleta = COALESCE($9, papeleta)
		 WHERE id = $1
		 RETURNING id, id_visitador, id_medico, fecha_visita, fecha_visita_tentativa,
		        latitud, longitud, firma, observacion, satisfaccion, duracion, ingreso, papeleta`,
		id, req.FechaVisita, req.FechaVisitaTentativa, req.Latitud, req.Longitud,
		req.Observacion, req.Satisfaccion, req.Duracion, req.Papeleta,
	).Scan(&v.ID, &v.IDVisitador, &v.IDMedico, &v.FechaVisita,
		&v.FechaVisitaTentativa, &v.Latitud, &v.Longitud, &v.Firma, &v.Observacion,
		&v.Satisfaccion, &v.Duracion, &v.Ingreso, &v.Papeleta)
	if err != nil {
		return nil, fmt.Errorf("visita no encontrada")
	}
	return &v, nil
}

func (r *VisitaRepository) Delete(ctx context.Context, id int) error {
	tag, err := r.pool.Exec(ctx, "DELETE FROM visitador_medico WHERE id = $1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("visita no encontrada")
	}
	return nil
}

func observacion(raw json.RawMessage) []byte {
	if len(raw) == 0 {
		return []byte("{}")
	}
	return raw
}