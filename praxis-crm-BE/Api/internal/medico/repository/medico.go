package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/medico/models"
)

// ErrSinPermiso se devuelve cuando un visitador intenta eliminar un médico
// que no está en su propia cartera.
var ErrSinPermiso = errors.New("sin permiso: el médico no pertenece a su cartera")

var matriculaEliminadoRe = regexp.MustCompile(`^E-(\d+)$`)

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

// GetByVisitadorID devuelve todos los médicos asignados a un visitador con sus
// datos personales y especialidad ya resueltos en una única consulta.
func (r *MedicoRepository) GetByVisitadorID(ctx context.Context, visitadorID int) ([]models.Medico, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT m.persona_id, m.codigo, m.matricula, m.especialidad_id, m.visitador_id, m.es_particular,
		        COALESCE(m.direccion, '{}'::jsonb), COALESCE(m.clasificacion, 0), COALESCE(m.frecuencia_visita, ''),
		        COALESCE(m.notas, '{}'::jsonb), m.status, m.creado_por, m.modificado_por, m.fecha_creacion, m.ultima_modificacion,
		        COALESCE(p.nombre, ''), COALESCE(p.primer_apellido, ''), p.segundo_apellido,
		        COALESCE(e.nombre, '')
		 FROM medico m
		 JOIN persona p ON p.id = m.persona_id
		 LEFT JOIN especialidad e ON e.id = m.especialidad_id
		 WHERE m.visitador_id = $1 AND m.status = true
		 ORDER BY p.nombre, p.primer_apellido`, visitadorID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var medicos []models.Medico
	for rows.Next() {
		var m models.Medico
		var nombre, primerApellido, esp string
		var segundoApellido *string
		err := rows.Scan(&m.PersonaID, &m.Codigo, &m.Matricula, &m.EspecialidadID, &m.VisitadorID, &m.EsParticular,
			&m.Direccion, &m.Clasificacion, &m.FrecuenciaVisita, &m.Notas, &m.Status,
			&m.CreadoPor, &m.ModificadoPor, &m.FechaCreacion, &m.UltimaModificacion,
			&nombre, &primerApellido, &segundoApellido, &esp)
		if err != nil {
			return nil, err
		}
		m.Nombre = &nombre
		m.PrimerApellido = &primerApellido
		m.SegundoApellido = segundoApellido
		m.Especialidad = &esp
		medicos = append(medicos, m)
	}
	return medicos, nil
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

func (r *MedicoRepository) Delete(ctx context.Context, userID *int, role string, personaID int) (string, error) {
	// Trae el dueño actual para validar que el visitador solo elimine
	// médicos de su propia cartera.
	var visitadorID *int
	var activo bool
	err := r.pool.QueryRow(ctx,
		`SELECT visitador_id, status FROM medico WHERE persona_id = $1`, personaID,
	).Scan(&visitadorID, &activo)
	if err != nil {
		return "", fmt.Errorf("médico no encontrado")
	}
	if !activo {
		return "", fmt.Errorf("médico ya eliminado")
	}
	if role == "visitador" {
		if userID == nil || visitadorID == nil || *visitadorID != *userID {
			return "", ErrSinPermiso
		}
	}

	// Baja lógica: status=false y matrícula reciclada a E-0001, E-0002, ...
	// Solo los eliminados llevan E-; la matrícula original se libera para
	// poder reutilizarse en altas futuras (la columna es UNIQUE).
	for intento := 0; intento < 5; intento++ {
		nueva, err := r.siguienteMatriculaEliminado(ctx)
		if err != nil {
			return "", err
		}
		tag, err := r.pool.Exec(ctx,
			`UPDATE medico SET status = false, matricula = $2, modificado_por = $3, ultima_modificacion = NOW()
			 WHERE persona_id = $1 AND status = true`,
			personaID, nueva, userID)
		if err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "duplicate key") {
				continue // carrera con otra baja: regenera el siguiente número
			}
			return "", err
		}
		if tag.RowsAffected() == 0 {
			return "", fmt.Errorf("médico ya eliminado")
		}
		return nueva, nil
	}
	return "", fmt.Errorf("no se pudo generar la matrícula de baja, intente de nuevo")
}

// siguienteMatriculaEliminado calcula el próximo E-NNNN (E-0001, E-0002, ...)
// a partir del máximo existente.
func (r *MedicoRepository) siguienteMatriculaEliminado(ctx context.Context) (string, error) {
	rows, err := r.pool.Query(ctx, `SELECT matricula FROM medico WHERE matricula LIKE 'E-%'`)
	if err != nil {
		return "", err
	}
	defer rows.Close()
	max := 0
	for rows.Next() {
		var m string
		if err := rows.Scan(&m); err != nil {
			return "", err
		}
		if sub := matriculaEliminadoRe.FindStringSubmatch(strings.TrimSpace(m)); sub != nil {
			if n, err := strconv.Atoi(sub[1]); err == nil && n > max {
				max = n
			}
		}
	}
	if err := rows.Err(); err != nil {
		return "", err
	}
	return fmt.Sprintf("E-%04d", max+1), nil
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
