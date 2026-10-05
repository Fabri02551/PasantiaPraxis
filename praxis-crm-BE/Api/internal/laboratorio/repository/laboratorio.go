package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/laboratorio/models"
)

const selectCols = `l.id, l.nombre, l.area, l.precio::float8, l.comision_extra::float8, l.status,
		  COALESCE(json_agg(json_build_object('ciudad_id', c.id, 'ciudad', c.nombre, 'costo', lc.costo::float8)
		    ORDER BY c.nombre) FILTER (WHERE lc.ciudad_id IS NOT NULL), '[]'),
		  l.creado_por, l.modificado_por, l.fecha_creacion, l.ultima_modificacion`

const fromJoin = `FROM laboratorio l
		  LEFT JOIN laboratorio_ciudad lc ON lc.laboratorio_id = l.id
		  LEFT JOIN ciudad c ON c.id = lc.ciudad_id`

type LaboratorioRepository struct {
	pool *pgxpool.Pool
}

func NewLaboratorioRepository(pool *pgxpool.Pool) *LaboratorioRepository {
	return &LaboratorioRepository{pool: pool}
}

func scanLaboratorio(scan func(dest ...any) error) (*models.Laboratorio, error) {
	var l models.Laboratorio
	err := scan(&l.ID, &l.Nombre, &l.Area, &l.Precio, &l.ComisionExtra, &l.Status, &l.CostosCiudad,
		&l.CreadoPor, &l.ModificadoPor, &l.FechaCreacion, &l.UltimaModificacion)
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func (r *LaboratorioRepository) GetAll(ctx context.Context) ([]models.Laboratorio, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+selectCols+` `+fromJoin+` WHERE l.status = true GROUP BY l.id ORDER BY l.nombre`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var labs []models.Laboratorio = []models.Laboratorio{}
	for rows.Next() {
		l, err := scanLaboratorio(rows.Scan)
		if err != nil {
			return nil, err
		}
		labs = append(labs, *l)
	}
	return labs, nil
}

func (r *LaboratorioRepository) GetByID(ctx context.Context, id int) (*models.Laboratorio, error) {
	l, err := scanLaboratorio(func(dest ...any) error {
		return r.pool.QueryRow(ctx,
			`SELECT `+selectCols+` `+fromJoin+` WHERE l.id = $1 GROUP BY l.id`, id,
		).Scan(dest...)
	})
	if err != nil {
		return nil, fmt.Errorf("laboratorio no encontrado")
	}
	return l, nil
}

// GetPreciosPorCiudad devuelve el costo por estudio para la cotización.
// Con ciudadID: costo = laboratorio_ciudad.costo (0 si la ciudad no lo ofrece).
// Sin ciudadID: costo = precio base del laboratorio.
func (r *LaboratorioRepository) GetPreciosPorCiudad(ctx context.Context, ciudadID *int) ([]models.LaboratorioPrecio, error) {
	var query string
	var args []any
	if ciudadID != nil {
		query = `SELECT l.id, l.nombre, l.area, COALESCE(lc.costo, 0)::float8, l.comision_extra::float8
		  FROM laboratorio l
		  LEFT JOIN laboratorio_ciudad lc ON lc.laboratorio_id = l.id AND lc.ciudad_id = $1
		  WHERE l.status = true
		  ORDER BY l.area, l.nombre`
		args = append(args, *ciudadID)
	} else {
		query = `SELECT l.id, l.nombre, l.area, l.precio::float8, l.comision_extra::float8
		  FROM laboratorio l
		  WHERE l.status = true
		  ORDER BY l.area, l.nombre`
	}

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.LaboratorioPrecio
	for rows.Next() {
		var lp models.LaboratorioPrecio
		if err := rows.Scan(&lp.ID, &lp.Nombre, &lp.Area, &lp.Costo, &lp.ComisionExtra); err != nil {
			return nil, err
		}
		items = append(items, lp)
	}
	return items, nil
}

func (r *LaboratorioRepository) Create(ctx context.Context, userID *int, req models.CreateLaboratorioRequest) (*models.Laboratorio, error) {
	var id int
	err := r.pool.QueryRow(ctx,
		`INSERT INTO laboratorio (nombre, area, precio, comision_extra, creado_por)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		req.Nombre, req.Area, req.Precio, req.ComisionExtra, userID,
	).Scan(&id)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id)
}

func (r *LaboratorioRepository) Update(ctx context.Context, userID *int, id int, req models.UpdateLaboratorioRequest) (*models.Laboratorio, error) {
	var foundID int
	err := r.pool.QueryRow(ctx,
		`UPDATE laboratorio SET
			nombre = COALESCE($2, nombre),
			area = COALESCE($3, area),
			precio = COALESCE($4, precio),
			comision_extra = COALESCE($5, comision_extra),
			status = COALESCE($6, status),
			modificado_por = $7, ultima_modificacion = NOW()
		 WHERE id = $1 RETURNING id`,
		id, req.Nombre, req.Area, req.Precio, req.ComisionExtra, req.Status, userID,
	).Scan(&foundID)
	if err != nil {
		return nil, fmt.Errorf("laboratorio no encontrado")
	}
	return r.GetByID(ctx, foundID)
}

func (r *LaboratorioRepository) Delete(ctx context.Context, userID *int, id int) error {
	tag, err := r.pool.Exec(ctx,
		"UPDATE laboratorio SET status = false, modificado_por = $2, ultima_modificacion = NOW() WHERE id = $1",
		id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("laboratorio no encontrado")
	}
	return nil
}