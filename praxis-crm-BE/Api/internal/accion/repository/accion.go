package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/accion/models"
)

type AccionRepository struct {
	pool *pgxpool.Pool
}

func NewAccionRepository(pool *pgxpool.Pool) *AccionRepository {
	return &AccionRepository{pool: pool}
}

func (r *AccionRepository) GetAll(ctx context.Context) ([]models.Accion, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, nombre_accion, ciudad, detalle, impacto_esperado, prioridad, status 
		 FROM accion ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var acciones []models.Accion
	for rows.Next() {
		var a models.Accion
		if err := rows.Scan(&a.ID, &a.NombreAccion, &a.Ciudad, &a.Detalle,
			&a.ImpactoEsperado, &a.Prioridad, &a.Status); err != nil {
			return nil, err
		}
		acciones = append(acciones, a)
	}
	return acciones, nil
}

func (r *AccionRepository) GetByID(ctx context.Context, id int) (*models.Accion, error) {
	var a models.Accion
	err := r.pool.QueryRow(ctx,
		`SELECT id, nombre_accion, ciudad, detalle, impacto_esperado, prioridad, status 
		 FROM accion WHERE id = $1`, id,
	).Scan(&a.ID, &a.NombreAccion, &a.Ciudad, &a.Detalle,
		&a.ImpactoEsperado, &a.Prioridad, &a.Status)
	if err != nil {
		return nil, fmt.Errorf("acción no encontrada")
	}
	return &a, nil
}

func (r *AccionRepository) Create(ctx context.Context, req models.CreateAccionRequest) (*models.Accion, error) {
	var a models.Accion
	err := r.pool.QueryRow(ctx,
		`INSERT INTO accion (nombre_accion, ciudad, detalle, impacto_esperado, prioridad) 
		 VALUES ($1, $2, $3, $4, $5) 
		 RETURNING id, nombre_accion, ciudad, detalle, impacto_esperado, prioridad, status`,
		req.NombreAccion, req.Ciudad, req.Detalle, req.ImpactoEsperado, req.Prioridad,
	).Scan(&a.ID, &a.NombreAccion, &a.Ciudad, &a.Detalle,
		&a.ImpactoEsperado, &a.Prioridad, &a.Status)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *AccionRepository) Update(ctx context.Context, id int, req models.UpdateAccionRequest) (*models.Accion, error) {
	var a models.Accion
	err := r.pool.QueryRow(ctx,
		`UPDATE accion SET nombre_accion = $1, ciudad = $2, detalle = $3, impacto_esperado = $4, 
		 prioridad = $5, status = $6 
		 WHERE id = $7 
		 RETURNING id, nombre_accion, ciudad, detalle, impacto_esperado, prioridad, status`,
		req.NombreAccion, req.Ciudad, req.Detalle, req.ImpactoEsperado,
		req.Prioridad, req.Status, id,
	).Scan(&a.ID, &a.NombreAccion, &a.Ciudad, &a.Detalle,
		&a.ImpactoEsperado, &a.Prioridad, &a.Status)
	if err != nil {
		return nil, fmt.Errorf("acción no encontrada")
	}
	return &a, nil
}

func (r *AccionRepository) Delete(ctx context.Context, id int) error {
	tag, err := r.pool.Exec(ctx, "UPDATE accion SET status = false WHERE id = $1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("acción no encontrada")
	}
	return nil
}