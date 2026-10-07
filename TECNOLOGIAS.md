# Tecnologías Usadas

Documento con las tecnologías principales utilizadas en el proyecto **PasantiaPraxis / Praxis CRM**.

## Frontend (`praxis-crm-FR/`)

- **React 19 + React DOM** – librería principal de UI
- **TypeScript ~6.0** – tipado estático
- **Vite 8 + @vitejs/plugin-react 6** – build y dev server (puerto 5173, proxy `/api` y `/health` a `localhost:8080`)
- **Leaflet 1.9 + React-Leaflet 5 + @types/leaflet** – mapas (médicos, instituciones, planificador)
- **Node.js 22 (Alpine)** – imagen de build en Docker
- **Nginx (Alpine)** – servidor de producción para el `dist/`
- **npm** – gestión de dependencias (`package-lock.json`)

### Testing / Calidad Frontend

- **Playwright 1.63** – tests e2e
- **Testing Library React + jest-dom** – tests de componentes
- **jsdom** – DOM para tests
- **oxlint** – linter (`npm run lint`)

## Backend API (`praxis-crm-BE/Api/`)

- **Go 1.27** – lenguaje del API
- **Standard library `net/http` + `http.ServeMux`** – router sin framework externo (rutas `GET /api/...`, `POST`, `PUT`, `DELETE`, `GET /health`)
- **github.com/jackc/pgx/v5** – driver/pool PostgreSQL
- **github.com/golang-jwt/jwt/v5** – autenticación JWT (`JWT_SECRET`, `JWT_EXPIRATION_HOURS=24`)
- **golang.org/x/crypto** – hashing (bcrypt) y utilidades cripto
- **golang.org/x/sync, golang.org/x/text** – dependencias indirectas
- **Docker multi-stage: `golang:1.27-alpine` → `alpine:3.20`** – binario estático `CGO_ENABLED=0`

Arquitectura por capas: `cmd/api` + `internal/{auth,medico,persona,visita,visitador,institucion,laboratorio,especialidad,ciudad,accion}/{handlers,services,repository,models,routes}` + `internal/core/{config,database,middleware}`.

## ETL (`praxis-crm-BE/Etl/`)

- **Go 1.26** – ETL principal (`pgx/v5`, `x/crypto`)
- **Python 3 + pandas** – script `rebuild_medicos.py` para reconstrucción de `medicos_carteras.csv` / `instituciones_carteras.csv` y `revisar_clasificacion.csv`
- Módulos estándar Python: `csv`, `re`, `unicodedata`, `collections`, `pathlib`

## Base de Datos

- **PostgreSQL 16 (Alpine)** – servicio `db` en Docker Compose (`praxis_crm`, usuario `praxis`)
- **SQL init:** `praxis-crm-BE/docker/init.sql` montado en `/docker-entrypoint-initdb.d/`
- Volúmenes: `pgdata` + healthcheck `pg_isready`

## DevOps / Infraestructura

- **Docker + Docker Compose** – orquestación de 3 servicios:
  - `db` (5432), `api` (8080), `web` (80/443/3000)
- **Nginx + certs/** – TLS montado como `./certs:/etc/nginx/certs:ro`
- Variables de entorno: `DATABASE_URL`, `API_PORT`, `APP_ENV`, `JWT_SECRET`
- Archivos: `docker-compose.yml`, `praxis-crm-FR/Dockerfile`, `praxis-crm-FR/nginx.conf`, `praxis-crm-BE/Api/Dockerfile`

## Otros

- **Git + GitHub** (`origin: Fabri02551/PasantiaPraxis.git`) – ramas `main`, `Dev`, `Backend`, etc.
- **CSV como fuente de ETL** – `Etl/src/medicos/`, `Etl/src/instituciones/`
- **Docs:** `ENDPOINTS_SCHEMA.md` (BE y FR), `docs/` en frontend
