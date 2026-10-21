#!/bin/sh
# Ejecutar dentro del contenedor API: docker exec praxis-api sh /app/scripts/create_admin_nicolas_api.sh
set -eu

DB_HOST=db
DB_USER=praxis
DB_NAME=praxis_crm
DB_PASS=praxis_secret
EMAIL=nicolastocoyucra@gmail.com
PASS=$(python3 -c "import secrets, string; print(''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(12)))")

# hash bcrypt
HASH=$(python3 -c "import bcrypt; print(bcrypt.hashpw(b'$PASS', bcrypt.gensalt(10)).decode())")

# eliminar si existe
PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c \
  "DELETE FROM users WHERE LOWER(email)='$EMAIL'; DELETE FROM persona WHERE LOWER(correo)='$EMAIL';" >/dev/null 2>&1 || true

# crear
PGPASSWORD=$DB_PASS psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
WITH ins AS (
  INSERT INTO persona (nombre, primer_apellido, sexo, correo, status)
  VALUES ('Nicolas','Tocoyucra','masculino','$EMAIL',true) RETURNING id
)
INSERT INTO users (persona_id,email,password_hash,role)
SELECT id,'$EMAIL','$HASH','admin' FROM ins;
" >/dev/null 2>&1

echo "ADMIN:$EMAIL|$PASS"
