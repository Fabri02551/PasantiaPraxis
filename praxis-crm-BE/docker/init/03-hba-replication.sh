#!/bin/sh
# ============================================================
# Praxis CRM - pg_hba.conf: permitir replicacion fisica
#
# Este archivo se ejecuta (o se sourcea, segun permisos) desde
# /docker-entrypoint-initdb.d/ SOLO la primera vez que se crea
# el volumen de datos.
#
# IMPORTANTE: docker-entrypoint.sh lo ejecuta con "$f" si tiene
# bit de ejecucion, o con ". $f" si no. Por eso este script
# NO usa "set -u": debe funcionar en ambos casos y no romper el
# entrypoint si algo falla. Ademas no puede usar sintaxis de bash
# (ni process substitution) porque no necesariamente hay bash.
# ============================================================

HBA_RULE='host replication replicator all scram-sha-256'

# Idempotente: no duplicar la regla si el script corre dos veces
if ! grep -q "^${HBA_RULE}$" "${PGDATA}/pg_hba.conf"; then
    printf '\n# --- Replicacion fisica hacia el mirror (agregado por init) ---\n%s\n' "${HBA_RULE}" >> "${PGDATA}/pg_hba.conf"
    echo "[init] regla pg_hba de replicacion agregada: ${HBA_RULE}"
else
    echo "[init] regla pg_hba de replicacion ya presente"
fi
