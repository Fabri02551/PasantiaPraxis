package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/api/internal/visita/models"
)

type VisitaRepository struct {
	pool *pgxpool.Pool
}

func NewVisitaRepository(pool *pgxpool.Pool) *VisitaRepository {
	return &VisitaRepository{pool: pool}
}

const scanCols = `id, id_visitador, id_medico, institucion_id, fecha_visita, fecha_visita_tentativa,
	latitud, longitud, ubicacion_destino_id, destino_direccion, destino_latitud, destino_longitud,
	gps_precision_m, distancia_destino_m, sin_evidencia_ubicacion,
	firma, observacion, satisfaccion, duracion, ingreso, papeleta, registrada, estado, extraordinaria`

func scanVisita(scan func(dest ...any) error) (*models.Visita, error) {
	var v models.Visita
	err := scan(
		&v.ID, &v.IDVisitador, &v.IDMedico, &v.InstitucionID, &v.FechaVisita, &v.FechaVisitaTentativa,
		&v.Latitud, &v.Longitud, &v.UbicacionDestinoID, &v.DestinoDireccion, &v.DestinoLatitud, &v.DestinoLongitud,
		&v.GPSPrecisionM, &v.DistanciaDestinoM, &v.SinEvidenciaUbicacion,
		&v.Firma, &v.Observacion, &v.Satisfaccion,
		&v.Duracion, &v.Ingreso, &v.Papeleta, &v.Registrada, &v.Estado, &v.Extraordinaria,
	)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (r *VisitaRepository) GetAll(ctx context.Context) ([]models.Visita, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT `+scanCols+` FROM visita
		 ORDER BY COALESCE(fecha_visita, fecha_visita_tentativa) DESC NULLS LAST, id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var visitas []models.Visita = []models.Visita{}
	for rows.Next() {
		v, err := scanVisita(rows.Scan)
		if err != nil {
			return nil, err
		}
		visitas = append(visitas, *v)
	}
	return visitas, nil
}

func (r *VisitaRepository) GetByID(ctx context.Context, id int) (*models.Visita, error) {
	v, err := scanVisita(func(dest ...any) error {
		return r.pool.QueryRow(ctx,
			`SELECT `+scanCols+` FROM visita WHERE id = $1`, id,
		).Scan(dest...)
	})
	if err != nil {
		return nil, fmt.Errorf("visita no encontrada")
	}
	return v, nil
}

// Create programada por el visitador (planificador) o el admin: visitador,
// médico o institución y fecha tentativa. Estado inicial: por_visitar.
//
// fecha_visita se deja NULL explícitamente: solo se llena al registrar la
// visita real. La extraordinaria se crea SIN fecha tentativa y se registra de
// inmediato, así que nunca queda "por visitar".
func (r *VisitaRepository) Create(ctx context.Context, req models.CreateVisitaRequest) (*models.Visita, error) {
	v, err := scanVisita(func(dest ...any) error {
		return r.pool.QueryRow(ctx,
			`INSERT INTO visita (id_visitador, id_medico, institucion_id, fecha_visita,
			                    fecha_visita_tentativa, ubicacion_destino_id,
			                    ingreso, registrada, estado, extraordinaria)
			 VALUES ($1, $2, $3, NULL, $4, $5, 0, false, 'por_visitar', $6)
			 RETURNING `+scanCols,
			req.IDVisitador, req.IDMedico, req.InstitucionID, req.FechaVisitaTentativa,
			req.UbicacionDestinoID, req.Extraordinaria,
		).Scan(dest...)
	})
	if err != nil {
		return nil, err
	}
	return v, nil
}

// Update del plan (admin). Con COALESCE: los campos omitidos se mantienen.
// Para cambiar a una institución el admin envía ambos campos.
func (r *VisitaRepository) Update(ctx context.Context, id int, req models.UpdateVisitaRequest) (*models.Visita, error) {
	v, err := scanVisita(func(dest ...any) error {
		return r.pool.QueryRow(ctx,
			`UPDATE visita SET
			        id_visitador = COALESCE($2, id_visitador),
			        id_medico = COALESCE($3, id_medico),
			        institucion_id = COALESCE($4, institucion_id),
			        fecha_visita_tentativa = COALESCE($5, fecha_visita_tentativa),
			        ubicacion_destino_id = COALESCE($6, ubicacion_destino_id)
			 WHERE id = $1
			 RETURNING `+scanCols,
			id, req.IDVisitador, req.IDMedico, req.InstitucionID, req.FechaVisitaTentativa,
			req.UbicacionDestinoID,
		).Scan(dest...)
	})
	if err != nil {
		return nil, fmt.Errorf("visita no encontrada")
	}
	return v, nil
}

// Registrar llena la visita real; la fecha tentativa ya estaba guardada.
// Cambia el estado de por_visitar a realizada.
//
// Los campos de auditoría geográfica (latitud/longitud del visitador,
// snapshot del destino, precisión, distancia) se escriben aquí. La distancia
// la calcula el service con haversine y llega en req.DistanciaDestinoM; nunca
// se acepta del cliente.
func (r *VisitaRepository) Registrar(ctx context.Context, id int, req models.RegistrarVisitaRequest) (*models.Visita, error) {
	if req.FechaVisita == nil {
		return nil, fmt.Errorf("fecha_visita es requerida")
	}

	v, err := scanVisita(func(dest ...any) error {
		return r.pool.QueryRow(ctx,
			`UPDATE visita SET
		        fecha_visita = $2,
		        latitud = $3,
		        longitud = $4,
		        gps_precision_m = $5,
		        distancia_destino_m = $6,
		        sin_evidencia_ubicacion = $7,
		        ubicacion_destino_id = COALESCE($8, ubicacion_destino_id),
		        destino_direccion = $9,
		        destino_latitud = $10,
		        destino_longitud = $11,
		        firma = $12,
		        observacion = $13,
		        satisfaccion = $14,
		        duracion = $15,
		        papeleta = $16,
		        registrada = true,
		        estado = 'realizada'
		 WHERE id = $1
			 RETURNING `+scanCols,
			id, req.FechaVisita, req.Latitud, req.Longitud, req.GPSPrecisionM,
			req.DistanciaDestinoM, req.SinEvidenciaUbicacion, req.UbicacionDestinoID,
			req.DestinoDireccion, req.DestinoLatitud, req.DestinoLongitud,
			req.Firma, observacion(req.Observacion),
			req.Satisfaccion, req.Duracion, req.Papeleta,
		).Scan(dest...)
	})
	if err != nil {
		return nil, fmt.Errorf("visita no encontrada")
	}
	return v, nil
}

func (r *VisitaRepository) Delete(ctx context.Context, id int) error {
	tag, err := r.pool.Exec(ctx, "DELETE FROM visita WHERE id = $1", id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("visita no encontrada")
	}
	return nil
}

func (r *VisitaRepository) GetLaboratorios(ctx context.Context, visitaID int) ([]models.VisitaLaboratorio, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT vl.laboratorio_id, l.nombre, l.area, vl.costo, vl.cantidad
		 FROM visita_laboratorio vl
		 JOIN laboratorio l ON l.id = vl.laboratorio_id
		 WHERE vl.visita_id = $1
		 ORDER BY l.nombre`, visitaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// make(…, 0) en vez de var: si la visita aún no tiene estudios, el slice
	// quedaría nil y `response.JSON` lo serializaría como null (y el frontend
	// no puede hacer .map de null). Cero estudios se representa como [].
	labs := make([]models.VisitaLaboratorio, 0)
	for rows.Next() {
		var x models.VisitaLaboratorio
		if err := rows.Scan(&x.LaboratorioID, &x.Nombre, &x.Area, &x.Costo, &x.Cantidad); err != nil {
			return nil, err
		}
		labs = append(labs, x)
	}
	return labs, nil
}

// AddLaboratorios agrega o actualiza estudios (con cantidad) a una visita,
// calculando el precio unitario según la ciudad del médico (o de la institución)
// y su comisión si es particular, y actualiza el ingreso.
func (r *VisitaRepository) AddLaboratorios(ctx context.Context, visitaID int, items []models.AddLaboratorioItem) ([]models.VisitaLaboratorio, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	for _, item := range items {
		var esParticular bool
		var costo, comision float64
		err := tx.QueryRow(ctx,
			`SELECT COALESCE(m.es_particular, i.es_particular, false),
			        COALESCE(lc.costo, 0), COALESCE(l.comision_extra, 0)
			 FROM visita v
			 LEFT JOIN medico m ON m.persona_id = v.id_medico
			 LEFT JOIN persona p ON p.id = m.persona_id
			 LEFT JOIN institucion i ON i.id = v.institucion_id
			 JOIN laboratorio l ON l.id = $2
			 LEFT JOIN laboratorio_ciudad lc
			        ON lc.laboratorio_id = l.id
			       AND lc.ciudad_id = COALESCE(p.ciudad_id, i.ciudad_id)
			 WHERE v.id = $1`,
			visitaID, item.LaboratorioID,
		).Scan(&esParticular, &costo, &comision)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, fmt.Errorf("visita no encontrada")
			}
			return nil, err
		}

		if esParticular {
			costo = costo * (1 + comision)
		}
		costo = math.Round(costo*100) / 100

		_, err = tx.Exec(ctx,
			`INSERT INTO visita_laboratorio (visita_id, laboratorio_id, costo, cantidad)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (visita_id, laboratorio_id)
			 DO UPDATE SET costo = EXCLUDED.costo, cantidad = EXCLUDED.cantidad`,
			visitaID, item.LaboratorioID, costo, item.Cantidad)
		if err != nil {
			return nil, err
		}
	}

	if err := r.recalcularIngreso(ctx, tx, visitaID); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.GetLaboratorios(ctx, visitaID)
}

func (r *VisitaRepository) RemoveLaboratorio(ctx context.Context, visitaID, laboratorioID int) ([]models.VisitaLaboratorio, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx,
		`DELETE FROM visita_laboratorio WHERE visita_id = $1 AND laboratorio_id = $2`,
		visitaID, laboratorioID)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, fmt.Errorf("estudio no está en la visita")
	}

	if err := r.recalcularIngreso(ctx, tx, visitaID); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.GetLaboratorios(ctx, visitaID)
}

func (r *VisitaRepository) recalcularIngreso(ctx context.Context, tx pgx.Tx, visitaID int) error {
	var ingreso float64
	if err := tx.QueryRow(ctx,
		`SELECT COALESCE(SUM(costo * cantidad), 0) FROM visita_laboratorio WHERE visita_id = $1`,
		visitaID,
	).Scan(&ingreso); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `UPDATE visita SET ingreso = $1 WHERE id = $2`, ingreso, visitaID)
	return err
}

func observacion(raw json.RawMessage) []byte {
	if len(raw) == 0 {
		return []byte("{}")
	}
	return raw
}
