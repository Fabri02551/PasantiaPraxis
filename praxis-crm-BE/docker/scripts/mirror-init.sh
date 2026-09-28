#!/bin/sh
# ============================================================
# Praxis CRM - Entrypoint del espejo (db-mirror)
#
# El contenedor arranca como HOT STANDBY de la primaria "db"
# usando replicacion fisica por streaming de WAL.
#
# - Si el volumen esta vacio: hace pg_basebackup de la primaria,
#   crea el slot de replicacion y arranca como standby.
# - Si el volumen ya tiene datos: los arranca tal cual. Ojo: si
#   este servidor fue promovido a primaria (failover manual), ya
#   no tiene standby.signal y arranca como primaria, que es
#   exactamente lo que se busca.
#
# Escrito en POSIX sh: la imagen postgres:alpine no garantiza
# bash y este script corre via "sh /scripts/mirror-init.sh".
# ============================================================
set -eu

PRIMARY_HOST="${PRIMARY_HOST:-db}"
PRIMARY_PORT="${PRIMARY_PORT:-5432}"
PRIMARY_USER="${PRIMARY_USER:-praxis}"
PRIMARY_PASSWORD="${PRIMARY_PASSWORD:-praxis_secret}"
REPLICATION_USER="${REPLICATION_USER:-replicator}"
REPLICATION_PASSWORD="${REPLICATION_PASSWORD:-replicator_secret}"
REPLICATION_SLOT="${REPLICATION_SLOT:-praxis_mirror_slot}"
APPLICATION_NAME="${APPLICATION_NAME:-praxis_mirror}"
PGDATA="${PGDATA:-/var/lib/postgresql/data/pgdata}"
WAIT_RETRIES="${WAIT_RETRIES:-150}"

log() {
    printf '[mirror] %s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

if [ -s "${PGDATA}/PG_VERSION" ]; then
    log "volumen ya inicializado, arrancando con la config existente"
else
    log "esperando a la primaria ${PRIMARY_HOST}:${PRIMARY_PORT} ..."
    attempt=0
    until PGPASSWORD="${PRIMARY_PASSWORD}" pg_isready \
        -h "${PRIMARY_HOST}" -p "${PRIMARY_PORT}" -U "${PRIMARY_USER}" -d postgres >/dev/null 2>&1
    do
        attempt=$((attempt + 1))
        if [ "${attempt}" -ge "${WAIT_RETRIES}" ]; then
            log "ERROR: la primaria no respondio tras ${WAIT_RETRIES} intentos"
            exit 1
        fi
        sleep 2
    done
    log "la primaria responde correctamente"

    # El slot se crea con -C en el pg_basebackup de abajo. Primero
    # soltamos un slot huerfano del intento anterior (pg_basebackup
    # falla si el nombre ya existe). El rol superusuario de la
    # primaria (no el replicator) es quien puede(drop_replication_slot).
    log "liberando slot de replicacion huerfano '${REPLICATION_SLOT}' (si existe)"
    PGPASSWORD="${PRIMARY_PASSWORD}" psql \
        -h "${PRIMARY_HOST}" -p "${PRIMARY_PORT}" \
        -U "${PRIMARY_USER}" -d postgres -v ON_ERROR_STOP=1 -q -c \
        "SELECT pg_drop_replication_slot('${REPLICATION_SLOT}')
         WHERE EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = '${REPLICATION_SLOT}');" \
        >/dev/null

    mkdir -p "${PGDATA}"
    log "ejecutando pg_basebackup desde ${PRIMARY_HOST} (puede tardar) ..."
    PGPASSWORD="${REPLICATION_PASSWORD}" pg_basebackup \
        -h "${PRIMARY_HOST}" -p "${PRIMARY_PORT}" \
        -U "${REPLICATION_USER}" \
        -D "${PGDATA}" \
        -Fp -Xs -P -c fast \
        -C -S "${REPLICATION_SLOT}"

    # pg_basebackup se trae postgresql.auto.conf tal cual. Si la
    # primaria estuvo alguna vez de failover (o fue rewindeada con
    # pg_rewind -R), ese archivo puede traer un primary_conninfo
    # apuntando a otro host. postgresql.auto.conf tiene MAS
    # precedencia que los -c de linea de comandos, asi que sin esta
    # limpieza el espejo intentaria replicarse del host equivocado
    # (tipicamente de si mismo, en bucle).
    if [ -f "${PGDATA}/postgresql.auto.conf" ]; then
        sed -i '/^[[:space:]]*primary_conninfo[[:space:]]*=/d; /^[[:space:]]*primary_slot_name[[:space:]]*=/d' \
            "${PGDATA}/postgresql.auto.conf"
    fi

    # -R no se usa a proposito: escribiria primary_conninfo en
    # postgresql.auto.conf, y ese archivo tiene MAS precedencia
    # que los -c de linea de comandos, asi que silenciosamente
    # pisaria la configuracion de mas abajo. Prefiero pasar la
    # conexion por -c para no dejar la password persistida en el
    # volumen del espejo.
    rm -f "${PGDATA}/standby.signal"
    touch "${PGDATA}/standby.signal"
    log "copia base completada, standby.signal creado"
fi

# Un postmaster.pid huerfano (apagon forzado del contenedor) le
# impediria arrancar a postgres. No hay ningun otro postgres
# corriendo sobre este volumen, asi que se puede borrar.
rm -f "${PGDATA}/postmaster.pid"

# En -c el valor es TODO lo que va despues del primer "=", taken
# literal: por eso primary_conninfo y primary_slot_name van SIN
# comillas. Con comillas postgres las tomaria como parte del valor
# y el arranque falla con "invalid character".
log "arrancando postgres (host=${PRIMARY_HOST} slot=${REPLICATION_SLOT} hot_standby=on)"

exec docker-entrypoint.sh postgres \
    -c hot_standby=on \
    -c hot_standby_feedback=on \
    -c wal_log_hints=on \
    -c max_connections=100 \
    -c "primary_conninfo=host=${PRIMARY_HOST} port=${PRIMARY_PORT} user=${REPLICATION_USER} password=${REPLICATION_PASSWORD} application_name=${APPLICATION_NAME} connect_timeout=5 sslmode=prefer" \
    -c "primary_slot_name=${REPLICATION_SLOT}" \
    -c recovery_target_timeline=latest
