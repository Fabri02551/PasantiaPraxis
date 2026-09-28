#!/bin/sh
# ============================================================
# Praxis CRM - Backup automatico con pg_dump
#
# Corre dentro del contenedor "backup". Hace un dump al arrancar
# y despues uno por dia a la hora configurada (BACKUP_AT), con
# pg_dump en formato custom comprimido.
#
# Por que "custom" y no SQL plano: ya viene comprimido con zlib,
# permite restaurar tablas en paralelo con "pg_restore -j" y se
# puede validar cheaply con "pg_restore --list".
#
# Escrito en POSIX sh y sin process substitution para que corra
# tanto con bash como con el ash de alpine.
# ============================================================
set -eu

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-praxis_crm}"
DB_USER="${DB_USER:-praxis}"
DB_PASSWORD="${DB_PASSWORD:-praxis_secret}"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_AT="${BACKUP_AT:-02:00}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
KEEP_MIN="${KEEP_MIN:-7}"
POLL_SECONDS="${POLL_SECONDS:-30}"
COMPRESS_LEVEL="${COMPRESS_LEVEL:-6}"
RUN_ON_START="${RUN_ON_START:-true}"

LOG_DIR="${BACKUP_DIR}/logs"

log() {
    printf '[backup] %s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

# ---------------------------------------------------------------- dumps

run_backup() {
    stamp="$(date -u '+%Y%m%d_%H%M%S')"
    name="${DB_NAME}_${stamp}.dump"
    final="${BACKUP_DIR}/${name}"
    partial="${final}.partial"
    log_file="${LOG_DIR}/backup-${stamp}.log"

    mkdir -p "${BACKUP_DIR}" "${LOG_DIR}"

    log "iniciando dump de ${DB_NAME}@${DB_HOST}:${DB_PORT} -> ${name}"

    # Se escribe primero a .partial y se renombra al final: si el
    # contenedor se muere a mitad de dump no queda un .dump
    # corrupto que parezca un backup valido.
    if PGPASSWORD="${DB_PASSWORD}" pg_dump \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --username="${DB_USER}" \
        --dbname="${DB_NAME}" \
        --format=custom \
        --compress="${COMPRESS_LEVEL}" \
        --no-owner \
        --no-privileges \
        --file="${partial}" >>"${log_file}" 2>&1
    then
        # Validacion barata: si pg_restore puede leer el catalogo
        # del dump, el archivo no esta truncado ni corrupto.
        if pg_restore --list "${partial}" >/dev/null 2>>"${log_file}"; then
            mv -f "${partial}" "${final}"
            size="$(du -h "${final}" | cut -f1)"
            if command -v sha256sum >/dev/null 2>&1; then
                checksum="$(sha256sum "${final}" | cut -d' ' -f1)"
                printf '%s  %s\n' "${checksum}" "${name}" >"${final}.sha256"
            fi
            # symlink de conveniencia, best-effort: en bind mounts
            # de Windows los symlinks suelen fallar y no es grave.
            ln -sf "${name}" "${BACKUP_DIR}/latest.dump" 2>/dev/null || true
            log "OK dump completo y verificado (${size})"
        else
            rm -f "${partial}"
            log "ERROR: el dump fallo la verificacion, descartado (ver ${log_file})"
            return 1
        fi
    else
        rm -f "${partial}"
        log "ERROR: pg_dump fallo (ver ${log_file})"
        return 1
    fi
}

# ---------------------------------------------------------------- retencion

count_dumps() {
    find "${BACKUP_DIR}" -maxdepth 1 -type f -name "${DB_NAME}_*.dump" 2>/dev/null | wc -l | tr -d ' '
}

purge_dumps() {
    # 1) Por antiguedad
    find "${BACKUP_DIR}" -maxdepth 1 -type f -name "${DB_NAME}_*.dump" \
        -mtime "+${RETENTION_DAYS}" -print 2>/dev/null \
    | while IFS= read -r victim; do
        log "purgando por antiguedad (>${RETENTION_DAYS}d): $(basename "${victim}")"
        rm -f "${victim}" "${victim}.sha256"
    done

    # 2) Red de seguridad: nunca bajar de KEEP_MIN dumps, aunque la
    #    regla de antiguedad los hubiera borrado a todos.
    total="$(count_dumps)"
    if [ "${total}" -gt "${KEEP_MIN}" ]; then
        excess=$((total - KEEP_MIN))
        find "${BACKUP_DIR}" -maxdepth 1 -type f -name "${DB_NAME}_*.dump" -print 2>/dev/null \
        | sort \
        | head -n "${excess}" \
        | while IFS= read -r victim; do
            log "purgando por exceso (min=${KEEP_MIN}): $(basename "${victim}")"
            rm -f "${victim}" "${victim}.sha256"
        done
    fi

    # logs, misma politica pero en su propia carpeta
    total_logs="$(find "${LOG_DIR}" -maxdepth 1 -type f -name 'backup-*.log' 2>/dev/null | wc -l | tr -d ' ')"
    if [ "${total_logs}" -gt "${KEEP_MIN}" ]; then
        excess_logs=$((total_logs - KEEP_MIN))
        find "${LOG_DIR}" -maxdepth 1 -type f -name 'backup-*.log' -print 2>/dev/null \
        | sort \
        | head -n "${excess_logs}" \
        | while IFS= read -r victim; do
            rm -f "${victim}"
        done
    fi

    log "retencion aplicada: $(count_dumps) dumps, ${total_logs} logs"
}

# ---------------------------------------------------------------- arranque

log "config: db=${DB_HOST}:${DB_PORT}/${DB_NAME} usuario=${DB_USER} dir=${BACKUP_DIR}"
log "config: diario a las ${BACKUP_AT} UTC, retencion=${RETENTION_DAYS}d, minimo=${KEEP_MIN} dumps"

log "esperando a la base de datos ..."
attempt=0
until PGPASSWORD="${DB_PASSWORD}" pg_isready \
    -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1
do
    attempt=$((attempt + 1))
    if [ "${attempt}" -ge "${WAIT_RETRIES:-150}" ]; then
        log "ERROR: la base de datos no respondio, el servicio de backup termina"
        exit 1
    fi
    sleep 5
done
log "base de datos disponible"

if [ "${RUN_ON_START}" = "true" ]; then
    run_backup || log "el backup inicial fallo, se reintentara en la proxima pasada"
fi
purge_dumps

# ---------------------------------------------------------------- ciclo

# Se compara HH:MM contra la hora del contenedor. Es MUCHOS mas
# simple y robusto que calcular epoch con "date -d", que en el
# busybox de alpine no soporta bien los formatos ISO.
log "esperando la proxima pasada a las ${BACKUP_AT} ..."
while true; do
    now_hm="$(date -u '+%H:%M')"
    if [ "${now_hm}" = "${BACKUP_AT}" ]; then
        run_backup || log "el backup programado fallo, se reintentara manualmente"
        purge_dumps
        sleep 61
    else
        sleep "${POLL_SECONDS}"
    fi
done
