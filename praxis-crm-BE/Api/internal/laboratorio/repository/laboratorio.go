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

	var labs []models.Laboratorio
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