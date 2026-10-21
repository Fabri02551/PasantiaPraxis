# PasantiaPraxis

CRM de Praxis Laboratorio Clínico: API en Go, ETL batch y frontend React, todo
levantado con `docker compose`.

## Arranque

```bash
cp .env.example .env      # una sola vez
docker compose up -d --build
docker compose logs -f etl-init
```

| Servicio | URL | Qué es |
|---|---|---|
| `web` | https://localhost:3000 (o `http://localhost`) | Frontend (nginx) compilado por Vite |
| `api` | http://localhost:8080 | API Go (JWT) |
| `etl-init` | — | Corre el ETL **una sola vez por base de datos** y termina |
| `db` | localhost:5433 | PostgreSQL 16 (host 5433 → contenedor 5432) |

- `web` y `api` publican puertos **en local**; el HTTPS de `web` sale de
  `docker-compose.override.yml`, que **no se commitea** (está en `.gitignore`)
  y monta `certs/` + `praxis-crm-FR/nginx-ssl.conf`. Al desplegar con dokploy
  el repo llega sin ese archivo: el nginx queda solo en el 80 y el TLS lo
  termina el proxy del dominio, así que nada choca con traefik.
- El GPS del visitador necesita contexto seguro: anda en `https://localhost:3000`
  y también en `http://localhost` (localhost es seguro por definición). Si
  entrás por IP desde el celular, ahí usá el https con los certs de
  `scripts/dev-certs.sh`.

El servicio `etl-init` carga los CSV en el primer arranque; después solo
registra que ya se hizo (tabla `etl_corrida`). Ver
[`praxis-crm-BE/Etl/README.md`](praxis-crm-BE/Etl/README.md).

## Variables de entorno

Hay **un solo archivo**: `.env` en la raíz del repo. No hay `.env` dentro de
`praxis-crm-BE/Api`, ni del ETL, ni del frontend.

- `.env` no se commitea; `.env.example` sí, y es la plantilla.
- `docker compose.yml` no tiene valores escritos a mano: todo sale de `${...}`
  interpolado desde el `.env` raíz.
- El frontend lo lee Vite con `envDir: '..'` (en `praxis-crm-FR/vite.config.ts`),
  y en Docker las `VITE_*` llegan como *build args* porque Vite las incrusta al
  compilar.
- Variables: `POSTGRES_*`, `DATABASE_URL`, `API_PORT`, `APP_ENV`, `JWT_*`,
  `ETL_*`, `VITE_*` (documentadas en `.env.example`).

## Estructura

```
praxis-crm-BE/     Go: Api/ (API HTTP) · Etl/ (carga de CSV) · docker/init.sql
praxis-crm-FR/     React + Vite + Leaflet
scripts/           utilidades de desarrollo (certificados, etc.)
certs/             certificados de desarrollo (por máquina, no se commitea)
docker-compose.yml
.env               configuración local (no se commitea)
```