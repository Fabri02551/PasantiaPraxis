package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/especialidad/models"
)

type EspecialidadRepository struct {
	pool *pgxpool.Pool
}

func NewEspecialidadRepository(pool *pgxpool.Pool) *EspecialidadRepository {
	return &EspecialidadRepository{pool: pool}
}

func (r *EspecialidadRepository) GetAll(ctx context.Context) ([]models.Especialidad, error) {
	rows, err := r.pool.Query(ctx, "SELECT id, nombre, codigo, status FROM especialidad ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var especialidades []models.Especialidad
	for rows.Next() {
		var e models.Especialidad
		if err := rows.Scan(&e.ID, &e.Nombre, &e.Codigo, &e.Status); err != nil {
			return nil, err
		}
		especialidades = append(especialidades, e)
	}
	return especialidades, nil
}

func (r *EspecialidadRepository) GetByID(ctx context.Context, id int) (*models.Especialidad, error) {
	var e models.Especialidad
	err := r.pool.QueryRow(ctx, "SELECT id, nombre, codigo, status FROM especialidad WHERE id = $1", id).
		Scan(&e.ID, &e.Nombre, &e.Codigo, &e.Status)
	if err != nil {
		return nil, fmt.Errorf("especialidad no encontrada")
	}
	return &e, nil
}

func (r *EspecialidadRepository) Create(ctx context.Context, req models.CreateEspecialidadRequest) (*models.Especialidad, error) {
	var e models.Especialidad
	err := r.pool.QueryRow(ctx,
		`INSERT INTO especialidad (nombre, codigo) VALUES ($1, $2) RETURNING id, nombre, codigo, status`,
		req.Nombre, req.Codigo,
	).Scan(&e.ID, &e.Nombre, &e.Codigo, &e.Status)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *EspecialidadRepository) Update(ctx context.Context, id int, req models.UpdateEspecialidadRequest) (*models.Especialidad, error) {
	var e models.Especialidad
	err := r.pool.QueryRow(ctx,
		`UPDATE especialidad SET nombre = $1, codigo = $2, status = $3 WHERE id = $4 RETURNING id, nombre, codigo, status`,
		req.Nombre, req.Codigo, req.Status, id,
	).Scan(&e.ID, &e.Nombre, &e.Codigo, &e.Status)
	if err != nil {
		return nil, fmt.Errorf("especialidad no encontrada")
	}
	return &e, nil
}

func (r *EspecialidadRepository) Delete(ctx context.Context, id int) error {
	tag, err := r.pool.Exec(ctx, "UPDATE especialidad SET status = false WHERE id = $1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("especialidad no encontrada")
	}
	return nil
}