package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/ciudad/models"
)

type CiudadRepository struct {
	pool *pgxpool.Pool
}

func NewCiudadRepository(pool *pgxpool.Pool) *CiudadRepository {
	return &CiudadRepository{pool: pool}
}

func (r *CiudadRepository) GetAll(ctx context.Context) ([]models.Ciudad, error) {
	rows, err := r.pool.Query(ctx, "SELECT id, nombre, status FROM ciudad ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ciudades []models.Ciudad
	for rows.Next() {
		var c models.Ciudad
		if err := rows.Scan(&c.ID, &c.Nombre, &c.Status); err != nil {
			return nil, err
		}
		ciudades = append(ciudades, c)
	}
	return ciudades, nil
}

func (r *CiudadRepository) GetByID(ctx context.Context, id int) (*models.Ciudad, error) {
	var c models.Ciudad
	err := r.pool.QueryRow(ctx, "SELECT id, nombre, status FROM ciudad WHERE id = $1", id).
		Scan(&c.ID, &c.Nombre, &c.Status)
	if err != nil {
		return nil, fmt.Errorf("ciudad no encontrada")
	}
	return &c, nil
}

func (r *CiudadRepository) Create(ctx context.Context, req models.CreateCiudadRequest) (*models.Ciudad, error) {
	var c models.Ciudad
	err := r.pool.QueryRow(ctx,
		`INSERT INTO ciudad (nombre) VALUES ($1) RETURNING id, nombre, status`,
		req.Nombre,
	).Scan(&c.ID, &c.Nombre, &c.Status)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *CiudadRepository) Update(ctx context.Context, id int, req models.UpdateCiudadRequest) (*models.Ciudad, error) {
	var c models.Ciudad
	err := r.pool.QueryRow(ctx,
		`UPDATE ciudad SET nombre = $1, status = $2 WHERE id = $3 RETURNING id, nombre, status`,
		req.Nombre, req.Status, id,
	).Scan(&c.ID, &c.Nombre, &c.Status)
	if err != nil {
		return nil, fmt.Errorf("ciudad no encontrada")
	}
	return &c, nil
}

func (r *CiudadRepository) Delete(ctx context.Context, id int) error {
	tag, err := r.pool.Exec(ctx, "UPDATE ciudad SET status = false WHERE id = $1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("ciudad no encontrada")
	}
	return nil
}