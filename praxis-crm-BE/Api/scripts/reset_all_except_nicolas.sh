#!/bin/sh
# SOLO CREAR - NO EJECUTAR
# docker exec praxis-api sh /app/scripts/reset_all_except_nicolas.sh
set -eu

DB_HOST=db
DB_USER=praxis
DB_NAME=praxis_crm
DB_PASS=praxis_secret

EMAILS=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -A -c \
  "SELECT LOWER(email) FROM users WHERE LOWER(email) != 'nicolastocoyucra@gmail.com' ORDER BY email;")

python3 -c "
# placeholder: solo crea estructura, no ejecuta envío
pass
"
