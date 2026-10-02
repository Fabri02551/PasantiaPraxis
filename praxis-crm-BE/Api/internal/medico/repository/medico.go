package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/medico/models"
)

type MedicoRepository struct {
	pool *pgxpool.Pool
}

func NewMedicoRepository(pool *pgxpool.Pool) *MedicoRepository {
	return &MedicoRepository{pool: pool}
}

const selectCols = `persona_id, codigo, matricula, especialidad_id, visitador_id, es_particular,
	COALESCE(direccion, '{}'::jsonb), COALESCE(clasificacion, 0), COALESCE(frecuencia_visita, ''),
	COALESCE(notas, '{}'::jsonb), status, creado_por, modificado_por, fecha_creacion, ultima_modificacion`

func scanMedico(scan func(dest ...any) error) (*models.Medico, error) {
	var m models.Medico
	err := scan(&m.PersonaID, &m.Codigo, &m.Matricula, &m.EspecialidadID, &m.VisitadorID, &m.EsParticular,
		&m.Direccion, &m.Clasificacion, &m.FrecuenciaVisita, &m.Notas, &m.Status,
		&m.CreadoPor, &m.ModificadoPor, &m.FechaCreacion, &m.UltimaModificacion)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *MedicoRepository) GetAll(ctx context.Context) ([]models.Medico, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+selectCols+` FROM medico ORDER BY persona_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var medicos []models.Medico
	for rows.Next() {
		m, err := scanMedico(rows.Scan)
		if err != nil {
			return nil, err
		}
		medicos = append(medicos, *m)
	}
	return medicos, nil
}

func (r *MedicoRepository) GetByID(ctx context.Context, personaID int) (*models.Medico, error) {
	m, err := scanMedico(func(dest ...any) error {
		return r.pool.QueryRow(ctx,
			`SELECT `+selectCols+` FROM medico WHERE persona_id = $1`, personaID,
		).Scan(dest...)
	})
	if err != nil {
		return nil, fmt.Errorf("médico no encontrado")
	}
	return m, nil
}

// GetPage devuelve una página de médicos con el total real de filas (para no
// cargar todos los registros en el frontend). El filtro q busca por nombre,
// apellidos, matrícula, código y nombre de especialidad. Los resultados salen
// del más reciente al más antiguo.
func (r *MedicoRepository) GetPage(ctx context.Context, page, limit int, q string) (int, []models.Medico, error) {
	offset := (page - 1) * limit
	var pattern string
	if strings.TrimSpace(q) != "" {
		escaped := strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(strings.TrimSpace(q))
		pattern = "%" + escaped + "%"
	}

	rows, err := r.pool.Query(ctx,
		`SELECT `+selectCols+`, COUNT(*) OVER() AS total
		 FROM medico
		 WHERE ($1 = '' OR codigo ILIKE $1 OR matricula ILIKE $1
		        OR persona_id IN (SELECT p.id FROM persona p
		          WHERE p.nombre ILIKE $1 OR p.primer_apellido ILIKE $1 OR p.segundo_apellido ILIKE $1)
		        OR especialidad_id IN (SELECT e.id FROM especialidad e WHERE e.nombre ILIKE $1))
		 ORDER BY persona_id DESC
		 LIMIT $2 OFFSET $3`, pattern, limit, offset)
	if err != nil {
		return 0, nil, err
	}
	defer rows.Close()

	var total int
	items := make([]models.Medico, 0, limit)
	for rows.Next() {
		m, err := scanMedico(func(dest ...any) error {
			return rows.Scan(append(dest, &total)...)
		})
		if err != nil {
			return 0, nil, err
		}
		items = append(items, *m)
	}
	return total, items, rows.Err()
}

func (r *MedicoRepository) Create(ctx context.Context, userID *int, req models.CreateMedicoRequest) (*models.Medico, error) {
	m, err := scanMedico(func(dest ...any) error {
		return r.pool.QueryRow(ctx,
			`INSERT INTO medico (persona_id, codigo, matricula, especialidad_id, visitador_id, es_particular, direccion, clasificacion, frecuencia_visita, notas, creado_por)
			 VALUES ($1, NULLIF($2, ''), $3, $4, $5, $6, $7, $8, $9, $10, $11)
			 RETURNING `+selectCols,
			req.PersonaID, req.Codigo, req.Matricula, req.EspecialidadID, req.VisitadorID, req.EsParticular,
			defaultJSON(req.Direccion), req.Clasificacion, req.FrecuenciaVisita, defaultJSON(req.Notas), userID,
		).Scan(dest...)
	})
	if err != nil {
		return nil, err
	}
	return m, nil
}

// CreateCompleto inserta la persona base y el médico dentro de una única
// transacción. Si el INSERT de medico falla (matricula duplicada, especialidad
// inexistente, etc.) se hace rollback y no queda ninguna persona huérfana.
// Es el camino que debe usar el frontend para no dejar basura por doble clic.
func (r *MedicoRepository) CreateCompleto(ctx context.Context, userID *int, p models.PersonaInput, req models.CreateMedicoRequest) (*models.Medico, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("error iniciando transacción: %w", err)
	}
	defer tx.Rollback(ctx)

	var personaID int
	err = tx.QueryRow(ctx,
		`INSERT INTO persona (nombre, primer_apellido, segundo_apellido, sexo, correo, telefono, ci, ciudad_id)
		 VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), $8)
		 RETURNING id`,
		p.Nombre, p.PrimerApellido, p.SegundoApellido, p.Sexo, p.Correo, p.Telefono, p.CI, p.CiudadID,
	).Scan(&personaID)
	if err != nil {
		return nil, fmt.Errorf("error creando persona: %w", err)
	}

	m, err := scanMedico(func(dest ...any) error {
		return tx.QueryRow(ctx,
			`INSERT INTO medico (persona_id, codigo, matricula, especialidad_id, visitador_id, es_particular, direccion, clasificacion, frecuencia_visita, notas, creado_por)
			 VALUES ($1, NULLIF($2, ''), $3, $4, $5, $6, $7, $8, $9, $10, $11)
			 RETURNING `+selectCols,
			personaID, req.Codigo, req.Matricula, req.EspecialidadID, req.VisitadorID, req.EsParticular,
			defaultJSON(req.Direccion), req.Clasificacion, req.FrecuenciaVisita, defaultJSON(req.Notas), userID,
		).Scan(dest...)
	})
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return m, nil
}

func (r *MedicoRepository) Update(ctx context.Context, userID *int, personaID int, req models.UpdateMedicoRequest) (*models.Medico, error) {
	m, err := scanMedico(func(dest ...any) error {
		return r.pool.QueryRow(ctx,
			`UPDATE medico SET codigo = COALESCE(NULLIF($1, ''), codigo),
			        matricula = COALESCE(NULLIF($2, ''), matricula),
			        especialidad_id = COALESCE($3, especialidad_id), visitador_id = COALESCE($4, visitador_id),
			        es_particular = COALESCE($5, es_particular),
			        direccion = COALESCE($6, direccion), clasificacion = COALESCE($7, clasificacion),
			        frecuencia_visita = COALESCE($8, frecuencia_visita), notas = COALESCE($9, notas),
			        status = COALESCE($10, status),
			        modificado_por = $11, ultima_modificacion = NOW()
			 WHERE persona_id = $12
			 RETURNING `+selectCols,
			req.Codigo, req.Matricula, req.EspecialidadID, req.VisitadorID, req.EsParticular, req.Direccion,
			req.Clasificacion, req.FrecuenciaVisita, req.Notas, req.Status, userID, personaID,
		).Scan(dest...)
	})
	if err != nil {
		return nil, fmt.Errorf("médico no encontrado")
	}
	return m, nil
}

func (r *MedicoRepository) Delete(ctx context.Context, userID *int, personaID int) error {
	tag, err := r.pool.Exec(ctx,
		"UPDATE medico SET status = false, modificado_por = $2, ultima_modificacion = NOW() WHERE persona_id = $1",
		personaID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("médico no encontrado")
	}
	return nil
}

// GetPersonaSexo devuelve el sexo de la persona del médico; si no existe la
// persona, devuelve error.
func (r *MedicoRepository) GetPersonaSexo(ctx context.Context, personaID int) (string, error) {
	var sexo string
	err := r.pool.QueryRow(ctx, `SELECT sexo FROM persona WHERE id = $1`, personaID).Scan(&sexo)
	if err != nil {
		if err == pgx.ErrNoRows {
			return "", fmt.Errorf("persona no encontrada")
		}
		return "", err
	}
	return sexo, nil
}

func defaultJSON(raw json.RawMessage) []byte {
	if len(raw) == 0 {
		return []byte("{}")
	}
	return raw
}
