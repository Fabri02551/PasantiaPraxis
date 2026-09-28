# Docker: base de datos con espejo, backups, API y frontend

Este directorio contiene la configuración de los servicios que viven en
`docker-compose.yml`, en la carpeta hermana `praxis-crm-BE/`:

| Servicio     | Qué es                                                      | Puerto host |
|--------------|-------------------------------------------------------------|-------------|
| `db`         | primaria. Acepta escrituras. `postgres:16-alpine`             | 5432        |
| `db-mirror`  | **espejo de solo lectura** (hot standby, replicación WAL)    | 5433        |
| `backup`     | backups automáticos con `pg_dump`                            | —           |
| `api`        | API en Go. Lee/escribe en la primaria activa                 | 8080        |
| `fr`         | frontend: SPA de Vite servida por nginx                      | 5173        |

El frontend está en el repo hermano `praxis-crm-FR/`, pero su servicio
`fr` se define acá, en este compose. Por eso el `context` del build
apunta a `../praxis-crm-FR`: **las dos carpetas tienen que estar al
mismo nivel** en el checkout.

## Levantar todo

```bash
cd praxis-crm-BE
cp .env.example .env      # opcional: tiene los defaults correctos
docker compose up -d --wait
```

La primera vez, `db` corre los scripts de `docker/init/` en orden:

1. `01-init.sql` — el esquema del CRM (tablas, índices).
2. `02-replicator.sql` — crea los roles `replicator` y `rewind_user`.
3. `03-hba-replication.sh` — agrega la regla de replicación al
   `pg_hba.conf`.

Y `db-mirror` se inicializa solo: hace un `pg_basebackup` de `db`,
crea el slot de replicación y arranca como standby. No hay que hacer
nada a mano.

`fr` compila el frontend la primera vez (tarda un poco más que los
demás, porque instala las dependencias de npm). Después queda cacheado
y los siguientes arranques son immediatos. Al final:

- Frontend → <http://localhost:5173>
- API → <http://localhost:8080>

## Frontend

### Cómo se conecta con la API

El navegador pide rutas relativas (`/api/ciudades`) y **nginx las
reenvía al servicio `api`**. De ahí salen tres cosas:

- **No hay CORS.** Para el navegador el front y la API son el mismo
  origen: `localhost:5173`.
- **La URL de la API no está en el bundle.** Nada de `VITE_API_URL`.
  El mismo build sirve para local, staging y producción.
- **`failover.sh` no rompe el front.** Tras un failover la API se
  recrea y suele cambiar de IP, pero nginx re-resuelve el nombre en
  cada pedido, así que solo hay unos segundos de 502 mientras la API
  vuelve. La SPA en sí se sigue sirviendo.

> Ese último punto depende de una línea de `praxis-crm-FR/nginx.conf`:
> el destino del proxy va en una **variable** (`set $api_upstream
> http://api:8080`) con un `resolver 127.0.0.11`. Si alguien lo
> escribe como `proxy_pass http://api:8080` a secas, nginx resuelve el
> nombre una sola vez al arrancar, se queda con la IP vieja, y el front
> queda muerto para siempre después del primer failover.

### Cambios en el frontend

| Quiero…                        | Hago esto                                                        |
|--------------------------------|------------------------------------------------------------------|
| Ver los cambios sin rebuild   | `docker compose up -d --build fr`                                 |
| Recargar todo desde cero      | `docker compose build --no-cache fr && docker compose up -d fr`   |
| Ver los logs de nginx         | `docker compose logs -f fr`                                      |
| Probar la config de nginx     | `docker compose exec fr nginx -t`                                |

El código fuente **no** se monta en volumen: el contenedor lleva una
copia del build. `docker compose up -d --build fr` es el ciclo normal.

### Desarrollar con hot reload

Para iterar rápido conviene no rebuildar el contenedor en cada cambio.
Con la API y la base ya levantadas:

```bash
cd praxis-crm-FR
npm install
npm run dev
```

Queda en <http://localhost:5173> (si el puerto está ocupado, Vite
avisa por consola y toma el siguiente libre).
`vite.config.ts` ya tiene un proxy de `/api` contra
`http://localhost:8080`, así que el dev server se comporta igual que el
contenedor y no hay que cambiar nada en el código.

### Ojo: el frontend todavía no habla con la API

`src/modules/auth/hooks/useAuth.ts` tiene el login como
`// TODO: Implement login logic`: la app es puramente visual y no
pide ningún dato al backend todavía. El proxy ya está listo para cuando
se escriba ese código; no hay nada más que configurar en el front.

## Comprobar que todo va bien

```bash
./docker/failover.sh status
```

O a mano:

```bash
docker compose logs -f db-mirror      # debe decir "started streaming WAL from primary"
docker compose exec db psql -U praxis -d postgres -c \
  "SELECT application_name, state, sync_state,
          pg_size_pretty(GREATEST(0, pg_wal_lsn_diff(sent_lsn, replay_lsn))) AS lag
   FROM pg_stat_replication;"
```

`lag` en 0 bytes y `state = streaming` significa que el espejo está al día.

## Backups

El servicio `backup` hace un `pg_dump` al arrancar y después uno por día
a la hora `BACKUP_AT` (por defecto 02:00 **UTC**). Los archivos quedan en
`praxis-crm-BE/backups/`:

```
backups/
  praxis_crm_20260927_020000.dump       <- dump en formato custom comprimido
  praxis_crm_20260927_020000.dump.sha256
  latest.dump                           <- symlink al más reciente
  logs/backup-20260927_020000.log       <- salida de esa corrida
```

Detalles que importan:

- **Formato custom comprimido**, no SQL plano: permite restaurar tablas
  en paralelo con `pg_restore -j` y se valida barato con
  `pg_restore --list`.
- Se escribe primero como `.partial` y recién ahí se renombra a `.dump`.
  Si el contenedor se muere a mitad de dump no queda un `.dump` roto
  que parezca un backup válido.
- Cada dump se verifica con `pg_restore --list` y se le calcula el
  SHA-256 antes de darla por buena.
- **Retención**: borra lo de más de `BACKUP_RETENTION_DAYS` (30) y, además,
  nunca baja de `BACKUP_KEEP_MIN` (7) archivos, para que un error de
  configuración no borre todos los backups.
- `backups/` está en `.gitignore`. **Es lo único que sobrevive a
  `docker compose down -v`**, así que conviene copiarlo a otro lado de vez
  en cuando.

### Ajustar la configuración

Todo se cambia en `.env`:

```bash
BACKUP_AT=02:00              # hora del dump (UTC)
BACKUP_RETENTION_DAYS=30     # borrar dumps de más de 30 días
BACKUP_KEEP_MIN=7            # nunca bajar de 7 dumps
BACKUP_RUN_ON_START=true     # hacer un dump también al arrancar
```

Después: `docker compose up -d --force-recreate backup`.

### Forzar un backup ahora

```bash
docker compose restart backup
```

### Ver los backups

```bash
ls -lht backups/*.dump
docker compose logs backup --tail 40
```

### Restaurar un backup

Un dump **no se aplica sobre una base con tablas**: hay que reemplazar
la base entera.

```bash
# 1. Copiar el dump al contenedor (en Windows también funciona con docker cp)
docker cp backups/praxis_crm_20260927_020000.dump praxis-db:/tmp/restore.dump

# 2. Recrear la base vacía
docker compose exec -T db psql -U praxis -d postgres \
  -c "DROP DATABASE praxis_crm WITH (FORCE);" \
  -c "CREATE DATABASE praxis_crm;"

# 3. Restaurar (por socket local, así no pide contraseña)
docker compose exec -T db pg_restore -U praxis -d praxis_crm \
  --no-owner --no-privileges /tmp/restore.dump

# 4. Comprobar
docker compose exec -T db psql -U praxis -d praxis_crm -c "\dt"
```

> Restaurar escribe en la primaria, así que **rompe la línea de tiempo del
> espejo**. Después de restaurar, hay que reconstruir el espejo:
> `docker compose rm -sf db-mirror && docker volume rm praxis-crm_mirror_pgdata && docker compose up -d db-mirror`

## Failover manual

`db-mirror` es de solo lectura, así que no se promotes solo: el cambio es
deliberado y hay que pedirlo explícitamente.

```bash
./docker/failover.sh status     # ver quién manda y cuánto lag hay
./docker/failover.sh promote    # db-mirror pasa a primaria
./docker/failover.sh failback   # db vuelve a ser primaria (usando pg_rewind)
```

En Windows el script necesita **Git Bash o WSL**. Si preferís pegar los
comandos a mano, están abajo.

### `promote` — la primaria está caída o corrupta

1. Verifica que el espejo sea un standby sano, esté en `streaming` y con
   menos de 16 MB de lag. Si algo de eso falla, **aborta**: promover un
   espejo atrasado perdería datos en silencio.
2. Para la API (para que no queden escrituras en vuelo).
3. `pg_promote()` sobre el espejo.
4. **Apaga la primaria vieja.** Si se dejara corriendo seguiría aceptando
   escrituras: eso es *split-brain* y las dos bases divergirían.
5. Pone `DB_HOST=db-mirror` en `.env` y levanta API y backups.

A partir de ahí la API escribe en el espejo. Las copias de `backups/`
siguen saliendo, porque el servicio toma su host de `DB_HOST`.

> **Importante:** la primaria vieja queda apagada y con datos que no
> existen en la nueva. No la arranques. Cuando la causa del problema esté
> resuelta, hacé el `failback`.

### `failback` — devolver el rol de primaria a `db`

Hace tres fases:

- **A. `pg_rewind`** sobre `db` (que está apagado) tomando `db-mirror`
  como origen. Devuelve el nodo al estado del último punto en común sin
  copiar los 78 MB enteros: solo los bloques que cambiaron.
  `pg_rewind` exige que el destino esté **apagado** y el origen
  **encendido**, y necesita `wal_log_hints=on` (ya está en la config) o
  data checksums.
- **B. Se apaga el espejo y se promueve `db`.** Antes de apagar el espejo
  el script mide cuántos bytes de WAL le quedan por replicar y espera,
  porque el WAL que el espejo genere en ese rato se perdería.
- **C. Se borra el volumen del espejo y se rehace.** Sus datos son de una
  línea de tiempo ya abandonada; lo más simple es un `pg_basebackup`
  nuevo, que es justo lo que hace `mirror-init.sh` solo.

### Los comandos a mano

Equivalentes a `promote`, en PowerShell:

```powershell
docker compose stop api
docker compose exec -T db-mirror psql -U praxis -d postgres -c "SELECT pg_promote(wait := true, wait_seconds := 60);"
docker compose stop db                          # evita split-brain
# poner DB_HOST=db-mirror en .env
docker compose up -d --no-deps api backup
```

> **`--no-deps` es obligatorio.** Sin él, compose ve el `depends_on` de la
> API y levanta también `db`, que está apagada a propósito. Es
> exactamente el error que arruinó el failover durante las pruebas.

## Si el volumen ya existía

Los scripts de `docker/init/` **solo corren cuando el volumen de datos
está vacío**. Si tenés una base previa y querés agregar la replicación
sin borrarla:

```bash
# 1. Crear los roles y permisos a mano (copiar el contenido de 02-replicator.sql)
docker compose exec -T db psql -U praxis -d praxis_crm -f -  < docker/init/02-replicator.sql

# 2. Agregar la regla de replicación al pg_hba.conf
docker compose exec -T db sh -c \
  "echo 'host replication replicator all scram-sha-256' >> \$PGDATA/pg_hba.conf"
docker compose exec -T db psql -U praxis -d postgres -c "SELECT pg_reload_conf();"

# 3. Recrear SOLO el espejo
docker compose rm -sf db-mirror
docker volume rm praxis-crm_mirror_pgdata
docker compose up -d --no-deps db-mirror
```

Ojo: los permisos de `rewind_user` hay que darlos **en cada base** desde
la que se conecte `pg_rewind`, porque los ACL de funciones viven en
`pg_proc`, que es un catálogo por base de datos.

## Archivos de este directorio

```
init/
  01-init.sql              esquema del CRM
  02-replicator.sql        roles replicator y rewind_user
  03-hba-replication.sh    regla de replicación en pg_hba.conf
scripts/
  mirror-init.sh           entrypoint del espejo: pg_basebackup + standby
  backup.sh                entrypoint del servicio de backups
  rewind-target.sh         prepara el objetivo de un pg_rewind
failover.sh                promote / failback / status
```

## Problemas frecuentes

**El espejo no arranca.** Mirá `docker compose logs db-mirror`. Casi
siempre es que falta el rol `replicator` o la regla del `pg_hba.conf`
(ver "Si el volumen ya existía").

**El espejo se quedó muy atrasado y la primaria llenó el disco.** El slot
de replicación retiene el WAL hasta que el espejo lo consume. Para
liberarlo:

```bash
docker compose exec -T db psql -U praxis -d postgres -c \
  "SELECT pg_drop_replication_slot('praxis_mirror_slot');"
```

Después reconstruí el espejo.

**Cambié la password de la primaria y el espejo dejó de conectarse.** El
`primary_conninfo` del espejo la tiene embebida. Reconstruí el espejo
(paso 3 de la sección anterior) y ajustá `REPLICATION_PASSWORD` en `.env`.

**`pg_rewind` dice que el destino no se apagó limpio.** Si se cayó de
golpe, tiene que completar la recuperación primero:

```bash
docker compose run --rm --no-deps --user postgres --entrypoint sh db \
  -c 'pg_ctl -D "$PGDATA" -o "-c default_transaction_read_only=off" \
         -w -t 60 start && pg_ctl -D "$PGDATA" -w -m fast stop'
```

**Quiero más replicas.** Copiá el servicio `db-mirror`, cambiá
`container_name`, el volumen, `APPLICATION_NAME`, `REPLICATION_SLOT` y el
puerto. Cada una necesita su propio slot.
