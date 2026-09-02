package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visitador/models"
)

type VisitadorRepository struct {
	pool *pgxpool.Pool
}

func NewVisitadorRepository(pool *pgxpool.Pool) *VisitadorRepository {
	return &VisitadorRepository{pool: pool}
}

func (r *VisitadorRepository) Create(ctx context.Context, v *models.Visitador) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("error starting transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	var personaID int
	err = tx.QueryRow(ctx,
		`INSERT INTO persona (nombres, apellidos, sexo, correo, telefono, ci)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		v.Nombres, v.Apellidos, v.Sexo, v.Correo, v.Telefono, v.CI,
	).Scan(&personaID)
	if err != nil {
		return fmt.Errorf("error creating persona: %w", err)
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO visitador (persona_id) VALUES ($1)`,
		personaID,
	)
	if err != nil {
		return fmt.Errorf("error creating visitador: %w", err)
	}

	return tx.Commit(ctx)
}

func (r *VisitadorRepository) List(ctx context.Context) ([]models.Visitador, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT v.persona_id, p.nombres, p.apellidos, p.sexo, p.correo, p.telefono, p.ci, v.activo, v.created_at
		 FROM visitador v
		 JOIN persona p ON p.id = v.persona_id
		 ORDER BY v.created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var visitadores []models.Visitador
	for rows.Next() {
		var v models.Visitador
		if err := rows.Scan(&v.PersonaID, &v.Nombres, &v.Apellidos, &v.Sexo, &v.Correo, &v.Telefono, &v.CI, &v.Activo, &v.CreatedAt); err != nil {
			return nil, err
		}
		visitadores = append(visitadores, v)
	}
	return visitadores, nil
}

func (r *VisitadorRepository) GetByID(ctx context.Context, id int) (*models.Visitador, error) {
	v := &models.Visitador{}
	err := r.pool.QueryRow(ctx,
		`SELECT v.persona_id, p.nombres, p.apellidos, p.sexo, p.correo, p.telefono, p.ci, v.activo, v.created_at
		 FROM visitador v
		 JOIN persona p ON p.id = v.persona_id
		 WHERE v.persona_id = $1`, id,
	).Scan(&v.PersonaID, &v.Nombres, &v.Apellidos, &v.Sexo, &v.Correo, &v.Telefono, &v.CI, &v.Activo, &v.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("visitador not found: %w", err)
	}
	return v, nil
}

func (r *VisitadorRepository) Update(ctx context.Context, id int, v *models.UpdateVisitadorRequest) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("error starting transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if v.Nombres != "" || v.Apellidos != "" || v.Telefono != "" {
		_, err = tx.Exec(ctx,
			`UPDATE persona SET
				nombres = COALESCE(NULLIF($1, ''), nombres),
				apellidos = COALESCE(NULLIF($2, ''), apellidos),
				telefono = COALESCE(NULLIF($3, ''), telefono)
			 WHERE id = $4`,
			v.Nombres, v.Apellidos, v.Telefono, id,
		)
		if err != nil {
			return fmt.Errorf("error updating persona: %w", err)
		}
	}

	if v.Activo != nil {
		_, err = tx.Exec(ctx,
			`UPDATE visitador SET activo = $1 WHERE persona_id = $2`,
			*v.Activo, id,
		)
		if err != nil {
			return fmt.Errorf("error updating visitador: %w", err)
		}
	}

	return tx.Commit(ctx)
}

func (r *VisitadorRepository) Delete(ctx context.Context, id int) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM visitador WHERE persona_id = $1`, id)
	if err != nil {
		return fmt.Errorf("error deleting visitador: %w", err)
	}
	return nil
}
