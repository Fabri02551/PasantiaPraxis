package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/institucion/models"
)

const selectCols = `id, nombre, razon_social, COALESCE(direccion, '{}'::jsonb), telefono, correo,
	tipo_contrato, nit, visitador_id, ciudad_id, es_particular, COALESCE(clasificacion, 0), status,
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

func (r *InstitucionRepository) Create(ctx context.Context, userID *int, req models.CreateInstitucionRequest) (*models.Institucion, error) {
	i, err := scanInstitucion(func(dest ...any) error {
		return r.pool.QueryRow(ctx,
			`INSERT INTO institucion (nombre, razon_social, direccion, telefono, correo, tipo_contrato, nit, visitador_id, ciudad_id, es_particular, clasificacion, creado_por)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
			        nit = COALESCE($8, nit),
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