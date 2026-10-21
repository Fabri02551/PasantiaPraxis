package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/persona/models"
)

// personaCols usa COALESCE en las columnas que el modelo declara como string
// (correo, telefono, ci) porque en la tabla son VARCHAR NULL y pgx no puede
// escanear NULL en un *string. Sin esto, GetByID/GetAll fallan con
// "cannot scan NULL into *string" y los medicos salen sin nombre.
// segundo_apellido y nacimiento si son punteros, por eso se leen tal cual.
const personaCols = `id, nombre, primer_apellido, segundo_apellido, sexo,
	COALESCE(correo, ''), COALESCE(telefono, ''), nacimiento, COALESCE(ci, ''), ciudad_id, status`

type PersonaRepository struct {
	pool *pgxpool.Pool
}

func NewPersonaRepository(pool *pgxpool.Pool) *PersonaRepository {
	return &PersonaRepository{pool: pool}
}

func (r *PersonaRepository) GetAll(ctx context.Context) ([]models.Persona, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+personaCols+` FROM persona ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var personas []models.Persona
	for rows.Next() {
		var p models.Persona
		if err := rows.Scan(&p.ID, &p.Nombre, &p.PrimerApellido, &p.SegundoApellido, &p.Sexo, &p.Correo,
			&p.Telefono, &p.Nacimiento, &p.CI, &p.CiudadID, &p.Status); err != nil {
			return nil, err
		}
		personas = append(personas, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return personas, nil
}

func (r *PersonaRepository) GetByID(ctx context.Context, id int) (*models.Persona, error) {
	var p models.Persona
	err := r.pool.QueryRow(ctx, `SELECT `+personaCols+` FROM persona WHERE id = $1`, id).Scan(&p.ID, &p.Nombre, &p.PrimerApellido, &p.SegundoApellido, &p.Sexo, &p.Correo,
		&p.Telefono, &p.Nacimiento, &p.CI, &p.CiudadID, &p.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("persona no encontrada")
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *PersonaRepository) Create(ctx context.Context, req models.CreatePersonaRequest) (*models.Persona, error) {
	var p models.Persona
	err := r.pool.QueryRow(ctx,
		`INSERT INTO persona (nombre, primer_apellido, segundo_apellido, sexo, correo, telefono, nacimiento, ci, ciudad_id) 
		 VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), $7, NULLIF($8, ''), $9) 
		 RETURNING `+personaCols,
		req.Nombre, req.PrimerApellido, req.SegundoApellido, req.Sexo, req.Correo, req.Telefono,
		req.Nacimiento, req.CI, req.CiudadID,
	).Scan(&p.ID, &p.Nombre, &p.PrimerApellido, &p.SegundoApellido, &p.Sexo, &p.Correo,
		&p.Telefono, &p.Nacimiento, &p.CI, &p.CiudadID, &p.Status)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *PersonaRepository) Update(ctx context.Context, id int, req models.UpdatePersonaRequest) (*models.Persona, error) {
	var p models.Persona
	err := r.pool.QueryRow(ctx,
		`UPDATE persona SET nombre = $1, primer_apellido = $2, segundo_apellido = $3, sexo = $4, correo = NULLIF($5, ''), telefono = NULLIF($6, ''), 
		 nacimiento = $7, ci = NULLIF($8, ''), ciudad_id = $9, status = COALESCE($10, status) 
		 WHERE id = $11 
		 RETURNING `+personaCols,
		req.Nombre, req.PrimerApellido, req.SegundoApellido, req.Sexo, req.Correo, req.Telefono,
		req.Nacimiento, req.CI, req.CiudadID, req.Status, id,
	).Scan(&p.ID, &p.Nombre, &p.PrimerApellido, &p.SegundoApellido, &p.Sexo, &p.Correo,
		&p.Telefono, &p.Nacimiento, &p.CI, &p.CiudadID, &p.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("persona no encontrada")
	}
	if err != nil {
		return nil, err
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
