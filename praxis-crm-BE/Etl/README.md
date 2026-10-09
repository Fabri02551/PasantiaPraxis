# ETL del backend Praxis CRM

Proceso batch en Go que extrae los CSV de carteras y catálogos, los normaliza
y los carga en la base de datos del CRM. **Es idempotente**: reejecutarlo
nunca duplica datos.

## Qué carga y en qué orden

El orden no es arbitrario: sale del grafo de claves foráneas. Si se cargara
médico antes que visitador, `medico.visitador_id` quedaría vacío porque la
columna "VISITADOR ASIGNADO" de la cartera se resuelve contra los
visitadores ya cargados.

| # | Etapa | Fuente | Llena |
|---|-------|--------|-------|
| 1 | ciudad | `src/ciudad/ciudades.csv` | `ciudad` |
| 2 | especialidad | `src/especialidad/especialidades.csv` | `especialidad` |
| 3 | visitador | `src/vistadores/visitadores.csv` | `persona`, `visitador`, `users` |
| 3b | admin | `ETL_ADMIN_EMAIL` | `persona`, `users` (rol `admin`) |
| 4 | medico | `src/medicos/medicos_carteras.csv` | `persona`, `medico` |
| 5 | institucion | `src/instituciones/instituciones_carteras.csv` | `institucion` |
| 6 | laboratorio | `src/laboratorios/precios_base_por_departamento.csv` | `laboratorio`, `laboratorio_ciudad` |

La etapa **admin** no lee ningún CSV: siembra la cuenta administradora
(`ETL_ADMIN_EMAIL`, por defecto `nicolastocoyucra@gmail.com`) con contraseña
aleatoria. Si la cuenta ya existe **no toca su contraseña** (para no pisar la
que el usuario cambió desde el perfil) y solo la promueve a `admin` si venía
con otro rol. Sin `ETL_ADMIN_EMAIL` la etapa queda omitida.

### Tablas que el ETL NO toca

- `visita` y `visita_laboratorio`: se generan desde la app serán con visitas
  reales. El ETL las deja explícitamente fuera.
- `institucion.clasificacion`: el usuario revisa cada institución y la sube
  **a mano** desde `src/instituciones/revisar_clasificacion.csv`.

## Reglas de carga

- **Not NULL sin dato** → valores por defecto:
  - `persona.nombre` = `SIN NOMBRE`, `persona.primer_apellido` = `SIN APELLIDO`
  - `persona.sexo` = `NO ESPECIFICADO`
  - `laboratorio.area` = `SIN AREA`
- **Opcionales vacíos** → `NULL` (teléfono, correo, ciudad).
- **`es_particular` = `true` para todos** los médicos e instituciones: la
  cartera no distingue.
- **`visitador_id` de médico e institución**: se resuelve con el Mapa de
  visitadores (nombre completo y aliases + tokens).
- **`medico.matricula`**: sintética `M-%06d` con el id de la persona.
  La columna de la cartera no sirve (MEDICO ID: 755 vacíos y los 169 valores
  distintos están repetidos; `N°`: 405 vacíos y 284 duplicados). `codigo` se
  deja NULL por la misma razón (es UNIQUE y la cartera repite valores).
- **`medico.especialidad_id`**: se resuelve contra el catálogo de
  especialidades; los valores que no cuadran quedan en `PEND`
  ("Sin especificar (revisar)").
- **`medico.ciudad_id`**: la columna CIUDAD y, si no resuelve, la ciudad del
  visitador asignado.
- **`laboratorio.precio`**: toma la primera columna `precio_base_*`; el
  detalle por ciudad va en `laboratorio_ciudad` (`0` = no disponible).

### Identidad / deduplicación

- **médico**: clave natural = nombre + `MEDICO ID`. Con `MEDICO ID` vacío,
  nombre + especialidad + institución. El nombre solo no alcanza: la cartera
  tiene 10 nombres repetidos y varios son personas distintas (ej. dos
  "DR. JOSE MARTIN DAZA" con NEU y NEUM). La clave se guarda en
  `medico.notas->>'cartera_clave'` para que una reejecución la reproduzca
  exacta aunque la especialidad viniera como alias.
- **institución / laboratorio**: nombre normalizado.
- **visitador**: CI (o correo como respaldo).

## Visita del pipeline

```
ciudad → especialidad → visitador → admin → medico → institucion → laboratorio
```

El log de consola imprime insertados/actualizados/omitidos/errores por
etapa. Las contraseñas generadas para visitadores nuevos se escriben en
`logs/visitadores_*.log` (ignorado por git, no commitear).

## Correos de credenciales

Al terminar la corrida, cada cuenta **creada en esa corrida** recibe su
contraseña **en su propia casilla** (SMTP de `SMTP_*` en el `.env`) y
`ETL_ADMIN_EMAIL` recibe además un resumen con todas las credenciales
nuevas. Las cuentas que ya existían no reciben nada: a ellas no se les
regeneró contraseña (en la base solo está el hash).

El log de la corrida lo deja explícito, para que no se confunda el resumen
con los envíos individuales:

```
[correo]  enviados=12 fallidos=1 | a su correo: 11 | resumen para el admin: 1
```

El servicio `etl-init` de compose corre **una sola vez por base de datos**
(base vacía): esa es la corrida en la que todos los visitadores del CSV son
nuevos y por eso todos reciben el suyo.

- Sin `SMTP_HOST` no se manda nada: las contraseñas quedan solo en
  `logs/visitadores_*.log` y la corrida sigue normal.
- Un fallo de SMTP tampoco aborta la carga: queda como `[correo]` en
  `logs/etl_*.log`. `etlinit` solo falla si falla la base, porque si no la
  API no arrancaría.
- Cada correo se reintenta hasta 3 veces: los servidores cortan conexiones
  de vez en cuando y un corte no debería dejar a un visitador sin clave.

Si aun así un envío se pierde, la contraseña está en `logs/` y se puede
mandar de nuevo sin resetearla:

```bash
go run ./cmd/reenvio -email visitador@x.com -password XXXX -nombre "Nombre Apellido"
```

## Ejecución

### Automática con docker compose (primera carga)

`docker compose up` levanta un servicio `etl-init` que corre este mismo ETL una
sola vez por base de datos:

```bash
docker compose up -d      # la primera vez carga los CSV; después no hace nada
docker compose logs etl-init
```

Cómo decide:

- El marcador es la tabla **`etl_corrida`** (la crea el propio comando con
  `CREATE TABLE IF NOT EXISTS`, no está en `init.sql` porque ese script solo
  corre cuando el volumen de Postgres está vacío).
- Si hay una corrida con `ok = TRUE`, `etl-init` imprime
  `la carga inicial ya se hizo ...; no se corre de nuevo` y sale con código 0.
- Las corridas fallidas quedan con `ok = FALSE` y **no** bloquean: el siguiente
  `docker compose up` las reintenta.
- Un advisory lock evita dos cargas a la vez (por ejemplo dos `compose up`
  simultáneos).
- `api` depende de `etl-init` con `service_completed_successfully`: si la carga
  falla, la API no arranca y el error se ve en `docker compose logs etl-init`.

Para rehacerla a mano hay que borrar el marcador:

```bash
docker exec praxis-db psql -U praxis -d praxis_crm -c "DELETE FROM etl_corrida"
docker compose up -d etl-init
```

Es seguro correrla otra vez: el pipeline es idempotente y a los visitadores que
ya existen solo les actualiza los datos, sin tocar su contraseña.

### Manual

```bash
# Una sola corrida (por defecto el proceso se queda en loop con ETL_EVERY)
ETL_ONCE=1 ETL_SRC_DIR=src go run ./cmd/etl

# Igual que el servicio de compose, pero respetando el marcador etl_corrida
go run ./cmd/etlinit

# Solo visitadores, escribe logs/visitadores_*.log con credenciales
go run ./cmd/visitadores -src src/vistadores/visitadores.csv -src-dir src -logs logs
```

Variables de entorno:

| Variable | Default | Descripción |
|---|---|---|
| `DATABASE_URL` | `postgres://localhost:5432/praxis_crm` | Conexión a la BD |
| `ETL_SRC_DIR` | `src` | Raíz de los CSV |
| `ETL_ONCE` | (vacío) | Si existe, corre una vez y termina |
| `ETL_EVERY` | `24h` | Frecuencia cuando no hay `ETL_ONCE` |
| `ETL_ADMIN_EMAIL` | `nicolastocoyucra@gmail.com` | Cuenta admin que siembra; vacío = no siembra |
| `SMTP_HOST` | (vacío) | Servidor SMTP; vacío = no manda correos |
| `SMTP_PORT` | `465` | Puerto SMTP |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | — | Credenciales de autenticación |
| `SMTP_FROM` / `SMTP_FROM_NAME` | `SMTP_USERNAME` | Remitente mostrado |
| `SMTP_ENCRYPTION` | `ssl` | `ssl` (465), `starttls` (587) o `plain` |
| `APP_URL` | `https://crm.laboratoriopraxis.com` | Enlace de ingreso que aparece en los correos |

## Fuentes

- `src/medicos/medicos_carteras.csv` y `src/instituciones/instituciones_carteras.csv`:
  producidos por `rebuild_medicos.py` desde los XLSX de kardex.
- `src/vistadores/visitadores.csv`: visitadores con sus cuentas de usuario.
- `src/ciudad/ciudades.csv` y `src/especialidad/especialidades.csv`: catálogos
  canónicos con códigos y sinónimos.
- `src/laboratorios/precios_base_por_departamento.csv`: estudios y precios por
  departamento. El archivo original de Excel tenía quoting roto (comillas
  sueltas y relleno) que `encoding/csv` no soporta; normalizarlo una vez con
  `tools/normaliza_laboratorios.py` para que cualquier lector lo entienda.

## Convenciones

- Una corrida debe ser idempotente: reejecutar nunca duplica datos.
- Los errores de catalogación abortan la etapa antes de insertar: un médico
  con la especialidad equivocada es peor que el ETL caído.
- `visita` y `visita_laboratorio` nunca se tocan.