package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"gitlab.com/labpraxis/praxis-crm-be/api/internal/medico/models"
)

type MedicoRepository struct {
	pool *pgxpool.Pool
}

func NewMedicoRepository(pool *pgxpool.Pool) *MedicoRepository {
	return &MedicoRepository{pool: pool}
}

func (r *MedicoRepository) GetAll(ctx context.Context) ([]models.Medico, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT persona_id, codigo, especialidad_id, visitador_id, es_particular, institucion, direccion, 
		        clasificacion, frecuencia_visita, notas, status 
		 FROM medico ORDER BY persona_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var medicos []models.Medico
	for rows.Next() {
		var m models.Medico
		if err := rows.Scan(&m.PersonaID, &m.Codigo, &m.EspecialidadID, &m.VisitadorID, &m.EsParticular,
			&m.Institucion, &m.Direccion, &m.Clasificacion, &m.FrecuenciaVisita, &m.Notas, &m.Status); err != nil {
			return nil, err
		}
		medicos = append(medicos, m)
	}
	return medicos, nil
}

func (r *MedicoRepository) GetByID(ctx context.Context, personaID int) (*models.Medico, error) {
	var m models.Medico
	err := r.pool.QueryRow(ctx,
		`SELECT persona_id, codigo, especialidad_id, visitador_id, es_particular, institucion, direccion, 
		        clasificacion, frecuencia_visita, notas, status 
		 FROM medico WHERE persona_id = $1`, personaID,
	).Scan(&m.PersonaID, &m.Codigo, &m.EspecialidadID, &m.VisitadorID, &m.EsParticular,
		&m.Institucion, &m.Direccion, &m.Clasificacion, &m.FrecuenciaVisita, &m.Notas, &m.Status)
	if err != nil {
		return nil, fmt.Errorf("médico no encontrado")
	}
	return &m, nil
}

func (r *MedicoRepository) Create(ctx context.Context, req models.CreateMedicoRequest) (*models.Medico, error) {
	var m models.Medico
	err := r.pool.QueryRow(ctx,
		`INSERT INTO medico (persona_id, codigo, especialidad_id, visitador_id, es_particular, institucion, direccion, clasificacion, frecuencia_visita, notas) 
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
		 RETURNING persona_id, codigo, especialidad_id, visitador_id, es_particular, institucion, direccion, clasificacion, frecuencia_visita, notas, status`,
		req.PersonaID, req.Codigo, req.EspecialidadID, req.VisitadorID, req.EsParticular, req.Institucion,
		req.Direccion, req.Clasificacion, req.FrecuenciaVisita, req.Notas,
	).Scan(&m.PersonaID, &m.Codigo, &m.EspecialidadID, &m.VisitadorID, &m.EsParticular,
		&m.Institucion, &m.Direccion, &m.Clasificacion, &m.FrecuenciaVisita, &m.Notas, &m.Status)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *MedicoRepository) Update(ctx context.Context, personaID int, req models.UpdateMedicoRequest) (*models.Medico, error) {
	var m models.Medico
	err := r.pool.QueryRow(ctx,
		`UPDATE medico SET codigo = $1, especialidad_id = $2, visitador_id = $3, es_particular = $4,
		 institucion = $5, direccion = $6, clasificacion = $7, frecuencia_visita = $8, notas = $9, status = $10 
		 WHERE persona_id = $11 
		 RETURNING persona_id, codigo, especialidad_id, visitador_id, es_particular, institucion, direccion, clasificacion, frecuencia_visita, notas, status`,
		req.Codigo, req.EspecialidadID, req.VisitadorID, req.EsParticular, req.Institucion, req.Direccion,
		req.Clasificacion, req.FrecuenciaVisita, req.Notas, req.Status, personaID,
	).Scan(&m.PersonaID, &m.Codigo, &m.EspecialidadID, &m.VisitadorID, &m.EsParticular,
		&m.Institucion, &m.Direccion, &m.Clasificacion, &m.FrecuenciaVisita, &m.Notas, &m.Status)
	if err != nil {
		return nil, fmt.Errorf("médico no encontrado")
	}
	return &m, nil
}

func (r *MedicoRepository) Delete(ctx context.Context, personaID int) error {
	tag, err := r.pool.Exec(ctx, "UPDATE medico SET status = false WHERE persona_id = $1", personaID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("médico no encontrado")
	}
	return nil
}