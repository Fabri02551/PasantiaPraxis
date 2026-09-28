#!/usr/bin/env bash
# ============================================================
# Praxis CRM - Failover manual entre la primaria y el espejo
#
#   ./docker/failover.sh status     estado y lag de replicacion
#   ./docker/failover.sh promote    db-mirror pasa a primaria
#   ./docker/failover.sh failback   db vuelve a ser primaria
#
# En Windows esto corre con Git Bash o WSL. Los comandos
# equivalentes, para pegar a mano, estan en docker/README.md.
# ============================================================
set -euo pipefail

# En Windows, con Git Bash (MSYS2), el runtime convierte las rutas
# POSIX absolutas a rutas de Windows antes de invocar los exes
# nativos. Asi /var/lib/postgresql/data se convierte en
# "C:/Program Files/Git/var/lib/postgresql/data" y pg_rewind revienta
# con "No such file or directory". Estas dos variables apagan esa
# conversion para todos los comandos que se lancen despues.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"

DB_SERVICE="db"
MIRROR_SERVICE="db-mirror"
MIRROR_VOLUME_KEY="mirror_pgdata"
# PGDATA real del servicio db: el volumen se monta en
# /var/lib/postgresql/data y no se sobreescribe, asi que el default
# de la imagen sigue siendo el valor efectivo.
PGDATA_PATH="/var/lib/postgresql/data"
# 16 MB. Tolerancia de lag antes de promover un espejo.
MAX_LAG_BYTES=16777216

cd "${PROJECT_DIR}"

# ------------------------------------------------------------- helpers

# "up -d" NUNCA se usa sin --no-deps en este script. Sin ese flag,
# compose arrastra los depends_on y levanta tambien db, que tras un
# failover esta apagada A PROPOSITO: arrancarla de nuevo deja dos
# primarias aceptando escrituras (split-brain) y el failover se
# deshace solo.
DC() { docker compose "$@"; }

step()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
info()  { printf '    %s\n' "$*"; }
warn()  { printf '\033[1;33m    AVISO: %s\033[0m\n' "$*"; }
die()   { printf '\033[1;31m    ERROR: %s\033[0m\n' "$*" >&2; exit 1; }

confirm() {
    local answer
    printf '\n\033[1;33m    %s [si/NO] \033[0m' "$1"
    read -r answer
    [ "${answer}" = "si" ] || die "cancelado"
}

# ------------------------------------------------------------- .env

# Reescribe DB_HOST=... en .env. Es el unico interruptor de todo
# el failover: la api y el servicio de backup leen esa variable.
set_active_db() {
    local target="$1"
    [ -f "${ENV_FILE}" ] || die "no existe ${ENV_FILE}"
    if grep -qE '^[[:space:]]*DB_HOST=' "${ENV_FILE}"; then
        sed -i -E "s|^[[:space:]]*DB_HOST=.*$|DB_HOST=${target}|" "${ENV_FILE}"
    else
        printf '\nDB_HOST=%s\n' "${target}" >>"${ENV_FILE}"
    fi
    info ".env -> DB_HOST=${target}"
}

get_active_db() {
    read_env_value DB_HOST "${DB_SERVICE}"
}

# Lee una clave de .env sin el trailing \r que mete git en Windows.
read_env_value() {
    local key="$1" fallback="$2" value
    value="$(grep -E "^[[:space:]]*${key}=" "${ENV_FILE}" 2>/dev/null \
        | tail -n 1 | cut -d= -f2- | sed 's/[[:space:]]*$//' || true)"
    printf '%s' "${value:-${fallback}}"
}

db_user() { read_env_value POSTGRES_USER praxis; }

# Corre un SQL contra un nodo y devuelve una sola celda.
#
# No aborta el script si la consulta falla (con "set -e" + pipefail
# un fallo dentro de $( ) cortaria todo el failover), y solo recorta
# espacios de los bordes: un "tr -d" se comia los espacios internos
# de los textos.
# Ninguna de estas consultas debe leer la entrada estandar: si lo
# hicieran se comerian el "si" del prompt de confirmacion (o lo que
# el usuario tenga tecleando) al ser un exec interactivo.
query() {
    local service="$1" sql="$2"
    DC exec -T "${service}" psql -U "$(db_user)" -d postgres -tAc "${sql}" \
        < /dev/null 2>/dev/null \
        | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' \
        || true
}

# Igual que query pero deja pasar el codigo de salida. Se usa en las
# comprobaciones de seguridad, donde un vacio por error NO debe
# interpretarse como "todo bien".
query_rc() {
    local service="$1" sql="$2"
    DC exec -T "${service}" psql -U "$(db_user)" -d postgres -tAc "${sql}" \
        < /dev/null 2>/dev/null \
        | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

# Cuanto WAL ha recibido el nodo y todavia no ha aplicado. Es la
# unica comparacion valida en los dos roles: pg_current_wal_lsn()
# esta PROHIBIDO durante recovery ("recovery is in progress").
apply_lag_sql="SELECT pg_size_pretty(GREATEST(0, pg_wal_lsn_diff(pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn())));"

# ------------------------------------------------------------- status

cmd_status() {
    step "Rol actual de cada nodo"
    info "DB_HOST en .env: $(get_active_db)"

    for svc in "${DB_SERVICE}" "${MIRROR_SERVICE}"; do
        if DC exec -T "${svc}" true < /dev/null >/dev/null 2>&1; then
            local role lag
            role="$(query "${svc}" "SELECT CASE WHEN pg_is_in_recovery() THEN 'standby (solo lectura)' ELSE 'primaria (acepta escrituras)' END;")"
            lag="$(query "${svc}" "${apply_lag_sql}")"
            printf '    %-11s %s   WAL sin aplicar: %s\n' \
                "${svc}" "${role:-estado desconocido}" "${lag:-?}"
        else
            printf '    %-11s apagado\n' "${svc}"
        fi
    done

    step "Conexion de replicacion (vista desde ${DB_SERVICE})"
    DC exec -T "${DB_SERVICE}" psql -U "$(db_user)" -d postgres -c \
        "SELECT application_name,
                state,
                sync_state,
                pg_size_pretty(GREATEST(0, pg_wal_lsn_diff(sent_lsn, replay_lsn))) AS lag
         FROM pg_stat_replication;" \
        || warn "la primaria no reporta ningun walsender conectado"

    step "Ultimos backups en ./backups"
    if ls backups/*.dump >/dev/null 2>&1; then
        ls -lht backups/*.dump | head -n 5
    else
        info "todavia no hay dumps (el servicio backup hace uno al arrancar)"
    fi
}

# ------------------------------------------------------------- promote

# Promover un standby atrasado pierde datos en silencio, asi que
# primero se comprueba el estado y el lag contra la primaria.
assert_mirror_healthy() {
    step "Verificando que el espejo sea un standby sano y al dia"

    DC exec -T "${MIRROR_SERVICE}" true < /dev/null >/dev/null 2>&1 \
        || die "el espejo no esta corriendo (docker compose up -d ${MIRROR_SERVICE})"

    local in_recovery streaming lag
    in_recovery="$(query_rc "${MIRROR_SERVICE}" "SELECT pg_is_in_recovery();")"
    [ -n "${in_recovery}" ] || die "no se pudo consultar el estado de ${MIRROR_SERVICE}."
    [ "${in_recovery}" = "t" ] \
        || die "${MIRROR_SERVICE} ya no es un standby (ya fue promovido). No hay nada que promover."

    streaming="$(query_rc "${DB_SERVICE}" \
        "SELECT count(*) FROM pg_stat_replication WHERE application_name = 'praxis_mirror' AND state = 'streaming';")"
    [ -n "${streaming}" ] || die "no se pudo consultar el estado de replicacion en ${DB_SERVICE}."
    [ "${streaming}" -ge 1 ] 2>/dev/null \
        || die "el espejo no esta en streaming con la primaria. Promoverlo ahora perderia datos."

    lag="$(query_rc "${DB_SERVICE}" \
        "SELECT GREATEST(0, pg_wal_lsn_diff(sent_lsn, replay_lsn)) FROM pg_stat_replication WHERE application_name = 'praxis_mirror';")"
    [ -n "${lag}" ] || die "no se pudo medir el lag de replicacion."
    [ "${lag}" -le "${MAX_LAG_BYTES}" ] 2>/dev/null \
        || die "el espejo esta ${lag} bytes atrasado (> ${MAX_LAG_BYTES}). Sincroniza antes de promover."

    info "lag del espejo respecto a la primaria: ${lag} bytes"
    info "OK: es seguro promover"
}

cmd_promote() {
    assert_mirror_healthy
    confirm "Se promovera ${MIRROR_SERVICE} a primaria. La API se caera unos segundos. Continuar?"

    step "Deteniendo la api para que no queden escrituras en vuelo"
    DC stop api

    step "Promoviendo ${MIRROR_SERVICE}"
    DC exec -T "${MIRROR_SERVICE}" psql -U "$(db_user)" -d postgres -tAc \
        "SELECT pg_promote(wait := true, wait_seconds := 60);" < /dev/null >/dev/null
    info "postgres confirmo la promocion"

    # La vieja primaria sigue creyendose primaria y aceptaria
    # escrituras: eso es split-brain. Se apaga de inmediato.
    step "Apagando la vieja primaria (${DB_SERVICE}) para evitar split-brain"
    DC stop "${DB_SERVICE}"

    step "Apuntando api y backups al nuevo primario"
    set_active_db "${MIRROR_SERVICE}"
    DC up -d --no-deps api backup

    step "Promocion completada"
    info "primaria activa:        ${MIRROR_SERVICE}"
    info "primaria vieja (apagada): ${DB_SERVICE}"
    warn "no arranques ${DB_SERVICE} a mano: se dividio y tiene datos que no existen aca."
    info "para volver a la normalidad:  ./docker/failover.sh failback"
}

# ------------------------------------------------------------- failback

cmd_failback() {
    step "Situacion actual"
    info "DB_HOST en .env: $(get_active_db)"

    local mirror_role
    mirror_role="$(query "${MIRROR_SERVICE}" "SELECT pg_is_in_recovery();")"
    [ "${mirror_role}" = "f" ] \
        || die "${MIRROR_SERVICE} no es primaria. El failback solo aplica despues de un promote."

    confirm "Se devolvera el rol de primaria a ${DB_SERVICE} con pg_rewind. Continuar?"

    step "Deteniendo la api"
    DC stop api

    # ---------------------------------------------------------- Fase A
    # pg_rewind exige: TARGET apagado y SOURCE corriendo. Por eso la
    # vieja primaria sigue apagada y el espejo (ya primaria) hace
    # de origen. Se ejecuta con "compose run --entrypoint" para poder
    # usar la herramienta sobre el volumen sin arrancar el postgres
    # de ese contenedor.
    #
    # El origen se conecta como rewind_user (rol de solo lectura con
    # los permisos de pg_rewind), NO como replicator. El script
    # rewind-target.sh deja luego la recuperacion configurada con
    # replicator, que es el unico que puede recibir WAL.
    step "Fase A: pg_rewind de ${DB_SERVICE} usando ${MIRROR_SERVICE} como origen"

    local repl_user repl_pass rewind_user rewind_pass
    repl_user="$(read_env_value REPLICATION_USER replicator)"
    repl_pass="$(read_env_value REPLICATION_PASSWORD replicator_secret)"
    rewind_user="$(read_env_value REWIND_USER rewind_user)"
    rewind_pass="$(read_env_value REWIND_PASSWORD rewind_user_secret)"

    if ! DC run --rm --no-deps -T \
        --user postgres \
        -e "SOURCE_HOST=${MIRROR_SERVICE}" \
        -e "REPL_USER=${repl_user}" \
        -e "REPL_PASSWORD=${repl_pass}" \
        -e "REWIND_USER=${rewind_user}" \
        -e "REWIND_PASSWORD=${rewind_pass}" \
        --entrypoint sh \
        "${DB_SERVICE}" \
        -c '/scripts/rewind-target.sh' < /dev/null
    then
        die "pg_rewind fallo. Si fallo a medias el volumen de ${DB_SERVICE} puede quedar inconsistente: reconstruyelo desde un .dump de ./backups."
    fi
    info "${DB_SERVICE} rewindeado. Queda como standby de ${MIRROR_SERVICE}"

    step "Arrancando ${DB_SERVICE} para que aplique el WAL pendiente"
    DC up -d --no-deps "${DB_SERVICE}"
    sleep 15

    local followers
    followers="$(query "${DB_SERVICE}" "SELECT count(*) FROM pg_stat_replication;")"
    if [ -z "${followers}" ]; then
        warn "no se pudo confirmar que ${DB_SERVICE} este siguiendo al espejo. Revisalo antes de seguir."
    else
        info "walsenders en ${DB_SERVICE}: ${followers} (1 = siguiendo al espejo)"
    fi

    # ---------------------------------------------------------- Fase B
    # Antes de apagar el espejo se comprueba que este ya replayo
    # todo su WAL: el WAL que se genera en el espejo despues de este
    # punto y antes del apagado se perderia.
    local behind
    behind="$(query_rc "${MIRROR_SERVICE}" \
        "SELECT GREATEST(0, pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) FROM pg_stat_replication LIMIT 1;")"
    [ -n "${behind}" ] || die "no se pudo medir cuantos bytes le faltan al espejo. Aborto antes de promover."
    info "WAL aun sin replicar en el espejo: ${behind} bytes"
    if [ "${behind}" -gt 0 ] 2>/dev/null; then
        warn "queda WAL sin replicar. Se espera a que el espejo lo aplique antes de continuar."
        sleep 10
        behind="$(query_rc "${MIRROR_SERVICE}" \
            "SELECT GREATEST(0, pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) FROM pg_stat_replication LIMIT 1;")"
        info "WAL sin replicar tras la espera: ${behind:-0} bytes"
    fi

    step "Fase B: apagando ${MIRROR_SERVICE} y promoviendo ${DB_SERVICE}"
    DC stop "${MIRROR_SERVICE}"
    DC exec -T "${DB_SERVICE}" psql -U "$(db_user)" -d postgres -tAc \
        "SELECT pg_promote(wait := true, wait_seconds := 60);" < /dev/null >/dev/null 2>&1 || true
    info "${DB_SERVICE} promovida"

    # La promocion deja un primary_conninfo guardado apuntando al
    # espejo. En modo primaria no molesta, pero se contaminaria al
    # hacer el pg_basebackup del espejo nuevo, asi que se limpia.
    DC exec -T -u postgres "${DB_SERVICE}" sed -i \
        '/^[[:space:]]*primary_conninfo[[:space:]]*=/d; /^[[:space:]]*primary_slot_name[[:space:]]*=/d' \
        "${PGDATA_PATH}/postgresql.auto.conf" 2>/dev/null || true

    # ---------------------------------------------------------- Fase C
    # El espejo quedo con datos de un timeline abandonado, asi que
    # se borra su volumen y se rehace con un pg_basebackup nuevo. Es
    # lo mas simple y es justo lo que mirror-init.sh hace solo.
    step "Fase C: reconstruyendo el espejo desde ${DB_SERVICE}"
    DC rm -sf "${MIRROR_SERVICE}" >/dev/null 2>&1 || true
    local mirror_volume
    mirror_volume="$(docker volume ls -q \
        --filter "label=com.docker.compose.volume=${MIRROR_VOLUME_KEY}" | head -n 1)"
    if [ -n "${mirror_volume}" ]; then
        docker volume rm -f "${mirror_volume}" >/dev/null 2>&1 \
            && info "volumen borrado: ${mirror_volume}" \
            || warn "no se pudo borrar ${mirror_volume}; borralo a mano o el pg_basebackup fallara"
    fi
    DC up -d --no-deps "${MIRROR_SERVICE}"

    step "Apuntando api y backups de vuelta a ${DB_SERVICE}"
    set_active_db "${DB_SERVICE}"
    DC up -d --no-deps api backup

    step "Failback completado"
    cmd_status
}

# ------------------------------------------------------------- main

case "${1:-status}" in
    status)   cmd_status ;;
    promote)  cmd_promote ;;
    failback) cmd_failback ;;
    *)
        cat <<'EOF'
Uso: ./docker/failover.sh <comando>

  status    Muestra que nodo es primario, el lag de replicacion y
            los ultimos backups. No modifica nada.
  promote   Convierte el espejo (db-mirror) en primaria. Para cuando
            la primaria este caida o corrupta.
  failback  Devuelve el rol de primaria a db con pg_rewind y
            reconstruye el espejo. Para despues de un promote, ya
            resuelta la causa del problema.
EOF
        exit 1
        ;;
esac
