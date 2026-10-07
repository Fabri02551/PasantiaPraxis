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

func (r *VisitadorRepository) Create(ctx context.Context, userID *int, v *models.Visitador) (int, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("error starting transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	var personaID int
	err = tx.QueryRow(ctx,
		`INSERT INTO persona (nombre, primer_apellido, segundo_apellido, sexo, correo, telefono, ci)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		v.Nombre, v.PrimerApellido, v.SegundoApellido, v.Sexo, v.Correo, v.Telefono, v.CI,
	).Scan(&personaID)
	if err != nil {
		return 0, fmt.Errorf("error creating persona: %w", err)
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO visitador (persona_id, creado_por, latitud, longitud) VALUES ($1, $2, $3, $4)`,
		personaID, userID, v.Latitud, v.Longitud,
	)
	if err != nil {
		return 0, fmt.Errorf("error creating visitador: %w", err)
	}

	if err := tx.Commit(ctx); err != nil { return 0, err }
	return personaID, nil
}

func (r *VisitadorRepository) List(ctx context.Context) ([]models.Visitador, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT v.persona_id, p.nombre, p.primer_apellido, p.segundo_apellido, COALESCE(p.sexo, ''), COALESCE(p.correo, ''), COALESCE(p.telefono, ''), COALESCE(p.ci, ''),
		        v.latitud, v.longitud, v.activo,
		        v.creado_por, v.modificado_por, v.fecha_creacion, v.ultima_modificacion
		 FROM visitador v
		 JOIN persona p ON p.id = v.persona_id
		 ORDER BY v.fecha_creacion DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var visitadores []models.Visitador
	for rows.Next() {
		var v models.Visitador
		if err := rows.Scan(&v.PersonaID, &v.Nombre, &v.PrimerApellido, &v.SegundoApellido, &v.Sexo, &v.Correo, &v.Telefono, &v.CI,
			&v.Latitud, &v.Longitud, &v.Activo,
			&v.CreadoPor, &v.ModificadoPor, &v.FechaCreacion, &v.UltimaModificacion); err != nil {
			return nil, err
		}
		visitadores = append(visitadores, v)
	}
	return visitadores, nil
}

func (r *VisitadorRepository) GetByID(ctx context.Context, id int) (*models.Visitador, error) {
	v := &models.Visitador{}
	err := r.pool.QueryRow(ctx,
		`SELECT v.persona_id, p.nombre, p.primer_apellido, p.segundo_apellido, COALESCE(p.sexo, ''), COALESCE(p.correo, ''), COALESCE(p.telefono, ''), COALESCE(p.ci, ''),
		        v.latitud, v.longitud, v.activo,
		        v.creado_por, v.modificado_por, v.fecha_creacion, v.ultima_modificacion
		 FROM visitador v
		 JOIN persona p ON p.id = v.persona_id
		 WHERE v.persona_id = $1`, id,
	).Scan(&v.PersonaID, &v.Nombre, &v.PrimerApellido, &v.SegundoApellido, &v.Sexo, &v.Correo, &v.Telefono, &v.CI,
		&v.Latitud, &v.Longitud, &v.Activo,
		&v.CreadoPor, &v.ModificadoPor, &v.FechaCreacion, &v.UltimaModificacion)
	if err != nil {
		return nil, fmt.Errorf("visitador not found: %w", err)
	}
	return v, nil
}

func (r *VisitadorRepository) Update(ctx context.Context, userID *int, id int, v *models.UpdateVisitadorRequest) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("error starting transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if v.Nombre != "" || v.PrimerApellido != "" || v.Telefono != "" {
		_, err = tx.Exec(ctx,
			`UPDATE persona SET
				nombre = COALESCE(NULLIF($1, ''), nombre),
				primer_apellido = COALESCE(NULLIF($2, ''), primer_apellido),
				telefono = COALESCE(NULLIF($3, ''), telefono)
			 WHERE id = $4`,
			v.Nombre, v.PrimerApellido, v.Telefono, id,
		)
		if err != nil {
			return fmt.Errorf("error updating persona: %w", err)
		}
	}

	// Se actualiza siempre: con COALESCE cada campo conserva su valor si el
	// request no lo trae (activo o coordenadas que no vienen de la API).
	_, err = tx.Exec(ctx,
		`UPDATE visitador SET
			activo = COALESCE($1, activo),
			latitud = COALESCE($2, latitud),
			longitud = COALESCE($3, longitud),
			modificado_por = $4,
			ultima_modificacion = NOW()
		 WHERE persona_id = $5`,
		v.Activo, v.Latitud, v.Longitud, userID, id,
	)
	if err != nil {
		return fmt.Errorf("error updating visitador: %w", err)
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
