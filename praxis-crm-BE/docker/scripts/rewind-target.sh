#!/bin/sh
# ============================================================
# Praxis CRM - Prepara la primaria vieja para volver a ser espejo
#
# Se ejecuta DENTRO del contenedor de la primaria vieja, con el
# postgres PARADO, justo despues de un failover. Deja el
# directorio de datos listo para arrancar como standby.
#
# Configuracion por variables de entorno:
#   SOURCE_HOST    host de la primaria que manda ahora mismo
#   REPL_USER      usuario de replicacion (con REPLICATION)
#   REPL_PASSWORD  password de ese usuario
#   REWIND_USER    usuario de solo lectura para pg_rewind
#   REWIND_PASSWORD
# ============================================================
set -eu

TARGET_PGDATA="${TARGET_PGDATA:-${PGDATA}}"

: "${SOURCE_HOST:?falta SOURCE_HOST}"
: "${REPL_USER:?falta REPL_USER}"
: "${REPL_PASSWORD:?falta REPL_PASSWORD}"
: "${REWIND_USER:?falta REWIND_USER}"
: "${REWIND_PASSWORD:?falta REWIND_PASSWORD}"

rewind_conn="host=${SOURCE_HOST} port=5432 user=${REWIND_USER} password=${REWIND_PASSWORD} dbname=postgres sslmode=disable"

echo "[rewind] pg_rewind: ${TARGET_PGDATA} <- ${SOURCE_HOST} (rol ${REWIND_USER})"
pg_rewind \
    --target-pgdata="${TARGET_PGDATA}" \
    --source-server="${rewind_conn}" \
    --progress

# NO se usa --write-recovery-conf a proposito. Esa opcion vuelca en
# postgresql.auto.conf el MISMO usuario con el que pg_rewind se
# conecto, y rewind_user no tiene el atributo REPLICATION: el nodo
# arrancaria sin poder recibir el streaming de WAL.
#
# Ademas pg_rewind copia entero el archivo de configuracion del
# origen, que puede traer un primary_conninfo de otro nodo (la doc
# lo advierte: puede hacer falta corregir la configuracion de
# recuperacion antes de arrancar el objetivo).
echo "[rewind] limpiando configuracion de replicacion heredada del origen"
sed -i '/^[[:space:]]*primary_conninfo[[:space:]]*=/d; /^[[:space:]]*primary_slot_name[[:space:]]*=/d' \
    "${TARGET_PGDATA}/postgresql.auto.conf" 2>/dev/null || true

# primary_conninfo va con comillas SIMILES porque aqui va dentro de
# postgresql.auto.conf, no en la linea de comandos.
echo "[rewind] escribiendo recuperacion contra ${SOURCE_HOST} como ${REPL_USER}"
cat >>"${TARGET_PGDATA}/postgresql.auto.conf" <<EOF
primary_conninfo = 'host=${SOURCE_HOST} port=5432 user=${REPL_USER} password=${REPL_PASSWORD} application_name=praxis_db connect_timeout=5 sslmode=prefer'
recovery_target_timeline = 'latest'
EOF

touch "${TARGET_PGDATA}/standby.signal"
echo "[rewind] listo: ${TARGET_PGDATA} arrancara como standby de ${SOURCE_HOST}"
