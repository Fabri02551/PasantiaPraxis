package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/persona/models"
)

type PersonaRepository struct {
	pool *pgxpool.Pool
}

func NewPersonaRepository(pool *pgxpool.Pool) *PersonaRepository {
	return &PersonaRepository{pool: pool}
}

func (r *PersonaRepository) GetAll(ctx context.Context) ([]models.Persona, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, nombres, apellidos, sexo, correo, telefono, nacimiento, ci, ciudad_id, status 
		 FROM persona ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var personas []models.Persona
	for rows.Next() {
		var p models.Persona
		if err := rows.Scan(&p.ID, &p.Nombres, &p.Apellidos, &p.Sexo, &p.Correo,
			&p.Telefono, &p.Nacimiento, &p.CI, &p.CiudadID, &p.Status); err != nil {
			return nil, err
		}
		personas = append(personas, p)
	}
	return personas, nil
}

func (r *PersonaRepository) GetByID(ctx context.Context, id int) (*models.Persona, error) {
	var p models.Persona
	err := r.pool.QueryRow(ctx,
		`SELECT id, nombres, apellidos, sexo, correo, telefono, nacimiento, ci, ciudad_id, status 
		 FROM persona WHERE id = $1`, id,
	).Scan(&p.ID, &p.Nombres, &p.Apellidos, &p.Sexo, &p.Correo,
		&p.Telefono, &p.Nacimiento, &p.CI, &p.CiudadID, &p.Status)
	if err != nil {
		return nil, fmt.Errorf("persona no encontrada")
	}
	return &p, nil
}

func (r *PersonaRepository) Create(ctx context.Context, req models.CreatePersonaRequest) (*models.Persona, error) {
	var p models.Persona
	err := r.pool.QueryRow(ctx,
		`INSERT INTO persona (nombres, apellidos, sexo, correo, telefono, nacimiento, ci, ciudad_id) 
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
		 RETURNING id, nombres, apellidos, sexo, correo, telefono, nacimiento, ci, ciudad_id, status`,
		req.Nombres, req.Apellidos, req.Sexo, req.Correo, req.Telefono,
		req.Nacimiento, req.CI, req.CiudadID,
	).Scan(&p.ID, &p.Nombres, &p.Apellidos, &p.Sexo, &p.Correo,
		&p.Telefono, &p.Nacimiento, &p.CI, &p.CiudadID, &p.Status)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *PersonaRepository) Update(ctx context.Context, id int, req models.UpdatePersonaRequest) (*models.Persona, error) {
	var p models.Persona
	err := r.pool.QueryRow(ctx,
		`UPDATE persona SET nombres = $1, apellidos = $2, sexo = $3, correo = $4, telefono = $5, 
		 nacimiento = $6, ci = $7, ciudad_id = $8, status = $9 
		 WHERE id = $10 
		 RETURNING id, nombres, apellidos, sexo, correo, telefono, nacimiento, ci, ciudad_id, status`,
		req.Nombres, req.Apellidos, req.Sexo, req.Correo, req.Telefono,
		req.Nacimiento, req.CI, req.CiudadID, req.Status, id,
	).Scan(&p.ID, &p.Nombres, &p.Apellidos, &p.Sexo, &p.Correo,
		&p.Telefono, &p.Nacimiento, &p.CI, &p.CiudadID, &p.Status)
	if err != nil {
		return nil, fmt.Errorf("persona no encontrada")
	}
	return &p, nil
}

func (r *PersonaRepository) Delete(ctx context.Context, id int) error {
	tag, err := r.pool.Exec(ctx, "UPDATE persona SET status = false WHERE id = $1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("persona no encontrada")
	}
	return nil
}