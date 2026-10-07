// Package primercarga decide si el ETL tiene que correr todavía.
//
// docker compose levanta un servicio que carga los CSV del primer arranque,
// pero ese servicio vuelve a levantarse en cada `docker compose up`: sin un
// marcador en la base, la segunda vez cargaría todo de nuevo. El pipeline es
// idempotente y no duplicaría nada, pero gastaría tiempo y, sobre todo, volvería
// a resetear las contraseñas de los visitadores que el usuario haya cambiado.
//
// El marcador es la tabla etl_corrida: si hay una corrida con ok = TRUE, el
// ETL ya se corrió contra esta base y no se vuelve a correr. Las corridas
// fallidas quedan registradas pero no bloquean el reintento del siguiente
// arranque.
package primercarga

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// claveLock es la clave del advisory lock que evita dos primeras cargas
// simultáneas (por ejemplo dos `docker compose up` a la vez). Es un entero
// arbitrario y fijo: solo tiene que coincidir entre los procesos.
const claveLock int64 = 8675309

// crearTabla se ejecuta en cada arranque, también sobre bases ya sembradas:
// por eso es IF NOT EXISTS y no va en init.sql (que solo corre cuando el
// volumen de Postgres está vacío).
const crearTabla = `
CREATE TABLE IF NOT EXISTS etl_corrida (
	id SERIAL PRIMARY KEY,
	iniciada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	terminada TIMESTAMPTZ,
	ok BOOLEAN NOT NULL DEFAULT FALSE,
	detalle TEXT
)`

// consultarUltimaOk devuelve la última corrida terminada con éxito. Si no hay
// ninguna, devuelve error pgx.ErrNoRows: es el estado normal de una base recién
// inicializada.
const consultarUltimaOk = `
SELECT COALESCE(terminada, NOW()), COALESCE(detalle, '')
FROM etl_corrida
WHERE ok = TRUE
ORDER BY id DESC
LIMIT 1`

// Preparar crea la tabla del marcador. Es idempotente.
func Preparar(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, crearTabla); err != nil {
		return fmt.Errorf("no se pudo crear la tabla de control del etl: %w", err)
	}
	return nil
}

// Estado resume si el ETL ya corrió contra esta base y cuándo.
type Estado struct {
	Corrio  bool
	Cuando  time.Time
	Detalle string
}

// Pendiente consulta el marcador y dice si todavía hay que correr el ETL.
func Pendiente(ctx context.Context, pool *pgxpool.Pool) (Estado, error) {
	var e Estado
	var cuando time.Time
	var detalle string
	err := pool.QueryRow(ctx, consultarUltimaOk).Scan(&cuando, &detalle)
	switch {
	case err == nil:
		return Estado{Corrio: true, Cuando: cuando, Detalle: detalle}, nil
	case errors.Is(err, pgx.ErrNoRows):
		return e, nil
	default:
		return e, fmt.Errorf("no se pudo leer el control del etl: %w", err)
	}
}

// TomarLock reserva una conexión del pool y le pide el advisory lock, para que
// dos procesos no hagan la primera carga a la vez. La conexión queda fuera del
// pool mientras el lock esté tomado: por eso hay que llamar a Liberar, y no
// solo por prolijidad sino porque el lock es de sesión y quedaría tomado.
func TomarLock(ctx context.Context, pool *pgxpool.Pool) (*pgxpool.Conn, error) {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("no se pudo reservar conexión para el lock del etl: %w", err)
	}
	if _, err := conn.Exec(ctx, "SELECT pg_advisory_lock($1)", claveLock); err != nil {
		conn.Release()
		return nil, fmt.Errorf("no se pudo bloquear el etl: %w", err)
	}
	return conn, nil
}

// Liberar suelta el lock y devuelve la conexión al pool.
func Liberar(ctx context.Context, conn *pgxpool.Conn) {
	// Un contexto sin cancelación: si el de la corrida ya venció, igual
	// queremos cerrar la sesión.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	_, _ = conn.Exec(ctx, "SELECT pg_advisory_unlock($1)", claveLock)
	conn.Release()
}

// Registrar guarda el resultado de la corrida. Las fallidas quedan con
// ok = FALSE para poder revisar qué pasó, pero no cuentan como marcador.
func Registrar(ctx context.Context, pool *pgxpool.Pool, iniciada, terminada time.Time, corridaErr error) error {
	ok := corridaErr == nil
	detalle := "primera carga"
	if corridaErr != nil {
		detalle = corridaErr.Error()
		if len(detalle) > 500 {
			detalle = detalle[:500]
		}
	}
	_, err := pool.Exec(ctx,
		"INSERT INTO etl_corrida (iniciada, terminada, ok, detalle) VALUES ($1, $2, $3, $4)",
		iniciada, terminada, ok, detalle)
	if err != nil {
		return fmt.Errorf("no se pudo registrar la corrida del etl: %w", err)
	}
	return nil
}
