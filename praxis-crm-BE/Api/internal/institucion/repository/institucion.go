package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/institucion/models"
)

const selectCols = `id, nombre, razon_social, COALESCE(direccion, '{}'::jsonb),
	COALESCE(telefono, ''), COALESCE(correo, ''), COALESCE(tipo_contrato, ''), COALESCE(nit, ''),
	visitador_id, ciudad_id, COALESCE(es_particular, false), COALESCE(clasificacion, 0), COALESCE(status, true),
	creado_por, modificado_por, fecha_creacion, ultima_modificacion`

type InstitucionRepository struct {
	pool *pgxpool.Pool
}

func NewInstitucionRepository(pool *pgxpool.Pool) *InstitucionRepository {
	return &InstitucionRepository{pool: pool}
}

func scanInstitucion(scan func(dest ...any) error) (*models.Institucion, error) {
	var i models.Institucion
	err := scan(&i.ID, &i.Nombre, &i.RazonSocial, &i.Direccion, &i.Telefono, &i.Correo,
		&i.TipoContrato, &i.NIT, &i.VisitadorID, &i.CiudadID, &i.EsParticular, &i.Clasificacion, &i.Status,
		&i.CreadoPor, &i.ModificadoPor, &i.FechaCreacion, &i.UltimaModificacion)
	if err != nil {
		return nil, err
	}
	return &i, nil
}

func (r *InstitucionRepository) GetAll(ctx context.Context) ([]models.Institucion, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+selectCols+` FROM institucion ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.Institucion
	for rows.Next() {
		i, err := scanInstitucion(rows.Scan)
		if err != nil {
			return nil, err
		}
		items = append(items, *i)
	}
	return items, nil
}

func (r *InstitucionRepository) GetByID(ctx context.Context, id int) (*models.Institucion, error) {
	i, err := scanInstitucion(func(dest ...any) error {
		return r.pool.QueryRow(ctx, `SELECT `+selectCols+` FROM institucion WHERE id = $1`, id).Scan(dest...)
	})
	if err != nil {
		return nil, fmt.Errorf("institución no encontrada")
	}
	return i, nil
}

// GetPage devuelve una página de instituciones con el total real de filas (para
// no cargar todos los registros en el frontend). El filtro q busca por nombre,
// razón social, NIT y nombre del visitador asignado. Los resultados salen del
// registro más reciente al más antiguo.
func (r *InstitucionRepository) GetPage(ctx context.Context, page, limit int, q string) (int, []models.Institucion, error) {
	offset := (page - 1) * limit
	var pattern string
	if strings.TrimSpace(q) != "" {
		escaped := strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(strings.TrimSpace(q))
		pattern = "%" + escaped + "%"
	}

	rows, err := r.pool.Query(ctx,
		`SELECT `+selectCols+`, COUNT(*) OVER() AS total
		 FROM institucion
		 WHERE ($1 = '' OR nombre ILIKE $1 OR razon_social ILIKE $1 OR nit ILIKE $1
		        OR visitador_id IN (SELECT p.id FROM persona p WHERE p.nombre ILIKE $1 OR p.primer_apellido ILIKE $1))
		 ORDER BY id DESC
		 LIMIT $2 OFFSET $3`, pattern, limit, offset)
	if err != nil {
		return 0, nil, err
	}
	defer rows.Close()

	var total int
	items := make([]models.Institucion, 0, limit)
	for rows.Next() {
		i, err := scanInstitucion(func(dest ...any) error {
			return rows.Scan(append(dest, &total)...)
		})
		if err != nil {
			return 0, nil, err
		}
		items = append(items, *i)
	}
	return total, items, rows.Err()
}

func (r *InstitucionRepository) Create(ctx context.Context, userID *int, req models.CreateInstitucionRequest) (*models.Institucion, error) {
	i, err := scanInstitucion(func(dest ...any) error {
		return r.pool.QueryRow(ctx,
			`INSERT INTO institucion (nombre, razon_social, direccion, telefono, correo, tipo_contrato, nit, visitador_id, ciudad_id, es_particular, clasificacion, creado_por)
			 VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), $8, $9, $10, $11, $12)
			 RETURNING `+selectCols,
			req.Nombre, req.RazonSocial, defaultJSON(req.Direccion), req.Telefono, req.Correo,
			req.TipoContrato, req.NIT, req.VisitadorID, req.CiudadID, req.EsParticular, req.Clasificacion, userID,
		).Scan(dest...)
	})
	if err != nil {
		return nil, err
	}
	return i, nil
}

func (r *InstitucionRepository) Update(ctx context.Context, userID *int, id int, req models.UpdateInstitucionRequest) (*models.Institucion, error) {
	i, err := scanInstitucion(func(dest ...any) error {
		return r.pool.QueryRow(ctx,
			`UPDATE institucion SET
			        nombre = COALESCE($2, nombre),
			        razon_social = COALESCE($3, razon_social),
			        direccion = COALESCE($4, direccion),
			        telefono = COALESCE($5, telefono),
			        correo = COALESCE($6, correo),
			        tipo_contrato = COALESCE($7, tipo_contrato),
			        nit = COALESCE(NULLIF($8, ''), nit),
			        visitador_id = COALESCE($9, visitador_id),
			        ciudad_id = COALESCE($10, ciudad_id),
			        es_particular = COALESCE($11, es_particular),
			        clasificacion = COALESCE($12, clasificacion),
			        status = COALESCE($13, status),
			        modificado_por = $14, ultima_modificacion = NOW()
			 WHERE id = $1
			 RETURNING `+selectCols,
			id, req.Nombre, req.RazonSocial, req.Direccion, req.Telefono, req.Correo, req.TipoContrato,
			req.NIT, req.VisitadorID, req.CiudadID, req.EsParticular, req.Clasificacion, req.Status, userID,
		).Scan(dest...)
	})
	if err != nil {
		return nil, fmt.Errorf("institución no encontrada")
	}
	return i, nil
}

func (r *InstitucionRepository) Delete(ctx context.Context, userID *int, id int) error {
	tag, err := r.pool.Exec(ctx,
		"UPDATE institucion SET status = false, modificado_por = $2, ultima_modificacion = NOW() WHERE id = $1",
		id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("institución no encontrada")
	}
	return nil
}

func defaultJSON(raw json.RawMessage) []byte {
	if len(raw) == 0 {
		return []byte("{}")
	}
	return raw
}