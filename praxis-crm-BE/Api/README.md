# API del backend Praxis CRM

Servicio HTTP en Go que expone la lógica de negocio y los datos del CRM (clientes, ventas, etc.) para el frontend u otros servicios.

## Estructura de carpetas

```
Api/
├── cmd/
│   └── api/            # Punto de entrada. Contiene main.go: arranca el servidor HTTP.
├── internal/           # Código privado de la aplicación (Go impide importarlo desde fuera).
│   ├── config/         # Lectura de variables de entorno y configuración del servicio.
│   ├── handlers/       # Controladores HTTP: reciben las peticiones y responden.
│   ├── middleware/     # Interceptores de peticiones: CORS, logging, auth, etc.
│   ├── models/         # Entidades de dominio (structs JSON) que viajan por el sistema.
│   ├── repository/     # Capa de acceso a datos: interfaces hacia Postgres u otra BD.
│   ├── routes/         # Definición de endpoints y su mapeo a handlers.
│   └── services/       # Lógica de negocio: reglas que orquestan repositorios.
├── migrations/         # Scripts SQL de migraciones del esquema de base de datos.
├── pkg/                # Código reutilizable que podría compartirse con otros proyectos.
│   └── response/       # Helpers para responder JSON y errores HTTP.
├── .env.example        # Plantilla de variables de entorno (copiar a .env).
├── Dockerfile          # Imagen Docker multi-stage para ejecutar el API.
├── go.mod / go.sum     # Dependencias del módulo Go.
└── README.md           # Este archivo.
```

## Flujo de una petición

```
Cliente → routes → middleware → handlers → services → repository → BD
```

## Ejecución local

```bash
cp .env.example .env
go run ./cmd/api
```

El health check queda disponible en `GET http://localhost:8080/health`.

## Ejecución con Docker

```bash
docker build -t praxis-api .
docker run --rm -p 8080:8080 --env-file .env praxis-api
```

## Convenciones

- `internal/` no debe importarse desde fuera de este módulo; es código privado.
- Los handlers no contienen lógica de negocio: delegan en `services`.
- Solo `repository` conoce detalles de persistencia.
