# Praxis CRM - Esquema de Endpoints (Backend → Frontend CRUD)

> **Backend:** `praxis-crm-BE/Api` — Go 1.26 + `jackc/pgx/v5` + `golang-jwt/jwt/v5`  
> **Base URL:** `http://localhost:8080` (`Api/internal/core/config/config.go:18` `API_PORT=8080` + `docker-compose.yml:28` `8080:8080`)  
> **DB:** `postgres://praxis:praxis_secret@db:5432/praxis_crm` (`docker-compose.yml:32`)  
> **CORS:** `*` (`Api/internal/core/middleware/cors.go:7` `Allow-Origin:*`, `Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`, `Headers: Content-Type,Authorization`)  
> **Auth:** `Authorization: Bearer <jwt>` (`Api/internal/core/middleware/auth.go:25`), `Claims{role}` (`auth.go:18`), `RequireRole("admin")` (`auth.go:55`) → `403 sin permisos`  
> **Respuesta OK:** `Api/internal/core/pkg/response/response.go:8` `JSON(w,status,v)` ; **Error:** `{"error": "mensaje"}`  
> **Health sin prefijo:** `Api/cmd/api/main.go:61` `GET /health` → `{"status":"ok"}`

Generado: 2026-09-16 — 33 endpoints totales

---

## 1. Configuración & Auth

| Variable | Fuente | Default | Frontend (`praxis-crm-FR/src/modules/core/config/env.ts:1`) |
|---|---|---|---|
| `API_PORT` | `Api/internal/core/config/config.go:18` | `8080` | `VITE_API_URL=http://localhost:8080` (`.env.example:1`) |
| `DATABASE_URL` | `config.go:19` | `postgres://localhost:5432/praxis_crm` | — |
| `JWT_SECRET` | `config.go:21` | `change-me-in-production` | `localStorage praxis_token` (`core/lib/storage.ts:1`) |
| `JWT_EXPIRATION_HOURS` | `config.go:22` | `24` → `86400s` | `expires_in` en login |

**Frontend cliente:** `praxis-crm-FR/src/modules/core/lib/api.ts:20` `api<T>(path, {auth})` + `apiClient.get/post/put/del/health`, inyecta `Authorization: Bearer <token>` si `auth=true`, `proxy /api → 8080` en `vite.config.ts:7` y `nginx.conf:7`.

---

## 2. Módulo AUTH — `Api/internal/auth/{models,handlers,routes,services,repository}`

**Archivos:** `models/auth.go:34`, `handlers/auth.go:20`, `routes/routes.go:11`, `services/auth.go:25`, `repository/auth.go:19`

### 2.1 POST /api/auth/login — PÚBLICO
- **Attr frontend necesarios (Create):** `email* (string)`, `password* (string)` → `LoginRequest:34`
- **Handler:** `handlers/auth.go:20` valida ambos no vacíos → `401 credenciales inválidas` si `bcrypt.CompareHashAndPassword` falla
- **Respuesta 200:** `TokenResponse:51` `{token, token_type:"Bearer", expires_in:86400, role:"admin"|"visitador"}`
- **Frontend service:** `praxis-crm-FR/src/modules/auth/services/auth.service.ts:1` `authService.login({email,password})` guarda `storage.setToken/setRole`
- **Ejemplo:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@praxis.com","password":"admin123"}'
# Usuarios seed creados: admin@praxis.com/admin123, visitador@praxis.com/visitador123
```
```ts
// FE
await apiClient.post<TokenResponse>('/api/auth/login', {email, password}, {auth:false})
```

### 2.2 POST /api/auth/register — ADMIN ONLY (`Auth + RequireRole("admin")` `routes.go:12`)
- **Attr:** `email*, password*, role ("admin"|"visitador", default visitador), nombre, primer_apellido, segundo_apellido, sexo, telefono, ci` → `RegisterRequest:39`
- **Lógica:** `services/auth.go:25` crea `persona` + `users` en transacción (`repository/auth.go:19` `INSERT INTO persona ... RETURNING id` + `INSERT INTO users ...`)
- **Respuesta 201:** `TokenResponse` del nuevo usuario
- **Errores:** `400 email ya registrado`, `400 json inválido`
- **Frontend:** `authService.register(req)` (requiere `Authorization: Bearer <adminToken>`)
- **Ejemplo:**
```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login -d '{"email":"admin@praxis.com","password":"admin123"}' | jq -r .token)
curl -X POST http://localhost:8080/api/auth/register \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"nuevo@praxis.com","password":"123456","role":"visitador","nombre":"Juan","primer_apellido":"Pérez"}'
```

---

## 3. Módulo CIUDAD — `Api/internal/ciudad/{models:5, handlers:21, routes:14}`

**Modelo BE:** `Ciudad:5` `{id int, nombre string, status bool, created_at time}` — `CreateCiudadRequest:12` `{nombre*}`, `Update:16` `{nombre, status *bool}`  
**Tabla:** `docker/init.sql:11` `ciudad (id SERIAL PK, nombre VARCHAR(255) NOT NULL, status BOOLEAN)`

| Método | Path | Auth | Handler | Atributos CRUD Frontend |
|---|---|---|---|---|
| `GET` | `/api/ciudades` | NO | `h.GetAll:21` | **Read list** → `Ciudad[]` |
| `GET` | `/api/ciudades/{id}` | NO | `h.GetByID:30` `r.PathValue("id")` | **Read one** `id: number` |
| `POST` | `/api/ciudades` | SI admin | `h.Create:45` valida `nombre` requerido | **Create** `{nombre*}` |
| `PUT` | `/api/ciudades/{id}` | SI admin | `h.Update:65` | **Update** `{nombre?, status?: boolean}` |
| `DELETE` | `/api/ciudades/{id}` | SI admin | `h.Delete:86` → `{"message":"ciudad eliminada"}` | **Delete** `id` |

```ts
// FE servicio ya creado: src/modules/core/services/ciudad.service.ts:5
ciudadService.list() // GET /api/ciudades
ciudadService.create({nombre:"La Paz"})
ciudadService.update(1, {nombre:"La Paz", status:false})
ciudadService.remove(1)
```

---

## 4. Módulo ESPECIALIDAD — `Api/internal/especialidad/models:5`

**Modelo:** `Especialidad:5` `{id, nombre, codigo UNIQUE, status, created_at}` — `Create:13` `{nombre*, codigo*}` — `Update:18` `{nombre?, codigo?, status?}`  
**Tabla:** `docker/init.sql:42` `especialidad (codigo VARCHAR(50) UNIQUE)`

| Método | Path | Auth | Handler |
|---|---|---|---|
| `GET` | `/api/especialidades` | NO | `GetAll:21` |
| `GET` | `/api/especialidades/{id}` | NO | `GetByID:30` |
| `POST` | `/api/especialidades` | SI admin | `Create:45` requiere `nombre` y `codigo` |
| `PUT` | `/api/especialidades/{id}` | SI admin | `Update:65` |
| `DELETE` | `/api/especialidades/{id}` | SI admin | `Delete:86` `especialidad eliminada` |

```ts
especialidadService.create({nombre:"Cardiología", codigo:"CARD-01"})
especialidadService.update(1, {codigo:"CARD-02", status:true})
```

---

## 5. Módulo PERSONA — `Api/internal/persona/models:7`

**Modelo:** `Persona:7` `{id, nombre*, primer_apellido*, segundo_apellido *string, sexo, correo, telefono, nacimiento *time, ci, ciudad_id *int, status bool, created_at}`  
**Create:** `CreatePersonaRequest:22` `{nombre*, primer_apellido*, segundo_apellido?, sexo?, correo?, telefono?, nacimiento?, ci?, ciudad_id?}`  
**Update:** `UpdatePersonaRequest:34` igual + `status *bool`  
**Tabla:** `docker/init.sql:20` `persona (ciudad_id FK ciudad.id)`

| Método | Path | Auth |
|---|---|---|
| `GET` | `/api/personas` | NO |
| `GET` | `/api/personas/{id}` | NO |
| `POST` | `/api/personas` | SI admin o visitador |
| `PUT` | `/api/personas/{id}` | SI admin |
| `DELETE` | `/api/personas/{id}` | SI admin (soft delete) |

**Nota de nulabilidad:** en la tabla `correo`, `telefono` y `ci` son VARCHAR NULL, pero el modelo Go los declara `string` (no puntero). El repositorio los lee con `COALESCE(correo, '')` en la constante `personaCols`; sin eso pgx falla con `cannot scan NULL into *string` y `GetAll`/`GetByID` devuelven error, lo que hacía que los médicos salieran sin nombre. Los `INSERT`/`UPDATE` usan `NULLIF($n, '')` para no guardar cadenas vacías.

```ts
personaService.create({nombre:"Ana", primer_apellido:"García", correo:"ana@praxis.com", ciudad_id:1})
personaService.update(1, {telefono:"+591 70000000", status:true})
```

---

## 6. Módulo MEDICO — `Api/internal/medico/models:8` (extiende Persona)

**Modelo:** `Medico:8` `{persona_id int PK/FK persona.id, codigo? string UNIQUE, matricula string UNIQUE NOT NULL, especialidad_id int NOT NULL FK especialidad.id, visitador_id? int FK visitador.persona_id, es_particular bool, direccion json.RawMessage, clasificacion int 0-5, frecuencia_visita string, notas json.RawMessage, status bool, creado_por? int, modificado_por? int, fecha_creacion, ultima_modificacion}`  
**Create:** `CreateMedicoRequest:26` `{persona_id*, matricula*, especialidad_id*, codigo?, visitador_id?, es_particular?, direccion?, clasificacion?, frecuencia_visita?, notas?}`  
**Update:** `UpdateMedicoRequest:39` `{matricula?, especialidad_id?, codigo?, visitador_id?, es_particular?, direccion?, clasificacion?, frecuencia_visita?, notas?, status?}`  
**Tabla:** `docker/init.sql:96` `medico (persona_id PK/FK persona, matricula UNIQUE NOT NULL, especialidad_id NOT NULL FK especialidad RESTRICT, direccion JSONB, notas JSONB)`

**No existe columna `institucion` ni `created_at`** en la tabla `medico`. El nombre, apellidos, sexo, teléfono, correo y CI del médico viven en `persona`, hay que pedirlos a `/api/personas/{id}`.

| Método | Path | Auth | Nota |
|---|---|---|---|
| `GET` | `/api/medicos` | NO | lista todos |
| `GET` | `/api/medicos/{persona_id}` | NO | `r.PathValue("persona_id")` |
| `POST` | `/api/medicos` | SI admin o visitador | `201`. Ver abajo |
| `PUT` | `/api/medicos/{persona_id}` | SI admin | |
| `DELETE` | `/api/medicos/{persona_id}` | SI admin | soft delete (`status=false`), mensaje `médico eliminado` |

### Alta atómica (persona + médico en una transacción)

Si `POST /api/medicos` incluye el objeto `persona`, el backend inserta **persona y médico dentro de una única transacción** (`MedicoRepository.CreateCompleto`, mismo patrón que `visitador`). Si el `INSERT` de médico falla, se hace rollback y **no queda ninguna persona huérfana**. Esta es la única forma en que el frontend debe hacer el alta.

Si viene `persona_id` (persona ya existente) en vez de `persona`, se comporta como antes: un solo `INSERT` en `medico`.

Códigos de respuesta:

| Código | Causa |
|---|---|
| `400` | falta `matricula`, falta `especialidad_id`, falta `sexo`, falta `nombre`/`primer_apellido`, o la especialidad no existe (violación de FK) |
| `409` | `matricula` o `codigo` duplicado, o la persona ya es médico |

```ts
// Alta correcta: UN solo POST, atómico. No hace falta el POST /api/personas previo.
const medico = await medicoService.create({
  matricula: "MED-001",          // obligatorio: NOT NULL UNIQUE
  especialidad_id: 1,            // obligatorio: NOT NULL
  persona: {                     // se inserta en la misma transacción
    nombre: "Roberto",
    primer_apellido: "García",
    segundo_apellido: "Flores",
    sexo: "masculino",           // obligatorio: el handler lo valida
    correo: "r@praxis.com",
    telefono: "70000000",
    ci: "1234567",
  },
  direccion: [{id:"u0", direccion:"Av. Arce 2158", detalle:"Consultorio 5", coords:[-16.4897,-68.1193]}],
  notas: { descripcion: "Cliente preferente" },
})
// medico.persona_id es el id de la persona recién creada
```

**Importante:** `direccion` y `notas` son columnas **JSONB**. Se debe enviar el objeto/array ya parseado, nunca `JSON.stringify(...)` — si se envía un string, Postgres lo guarda como un *string* JSON y la vista ya no puede leerlo como lista de ubicaciones.

**Anti doble clic en el frontend:** además de `disabled` en el botón, hay que usar un `useRef` como guardia. `setSaving(true)` no actualiza el valor de `saving` hasta el siguiente render, así que dos clics muy seguidos pasarían la validación de state. El patrón usado en `MedicosAdmin.tsx` / `Medicos.tsx`:

```ts
const savingRef = useRef(false)
const [saving, setSaving] = useState(false)

const handleCreate = async (e) => {
  e.preventDefault()
  if (savingRef.current) return      // guarda real, no depende del render
  savingRef.current = true
  setSaving(true)
  try { /* ... */ } finally { savingRef.current = false; setSaving(false) }
}
```

**Frontend:** `src/modules/core/services/medico.service.ts`, `src/modules/core/utils/medicoDireccion.ts` (`normalizeUbicaciones` / `hospitalFromDireccion`), `src/modules/core/components/Toast/Toast.tsx`, `src/modules/admin/views/MedicosAdmin/MedicosAdmin.tsx`, `src/modules/visitador/views/Medicos/Medicos.tsx`, `src/modules/visitador/views/Cartera/Cartera.tsx` (filtra por `visitadorAsignado`).

---

## 7. Módulo ACCION — `Api/internal/accion/models:8`

**Modelo:** `Accion:8` `{id, nombre_accion*, ciudad json.RawMessage, detalle string, impacto_esperado string, prioridad int 0-3, status bool, created_at}`  
**Create:** `CreateAccionRequest:19` `{nombre_accion*, ciudad?, detalle?, impacto_esperado?, prioridad?}`  
**Update:** `UpdateAccionRequest:27` igual + `status?`  
**Tabla:** `docker/init.sql:99` `accion (prioridad SMALLINT CHECK 0-3)`

| Método | Path | Auth |
|---|---|---|
| `GET` | `/api/acciones` | NO |
| `GET` | `/api/acciones/{id}` | NO |
| `POST` | `/api/acciones` | SI admin |
| `PUT` | `/api/acciones/{id}` | SI admin |
| `DELETE` | `/api/acciones/{id}` | SI admin |

```ts
accionService.create({nombre_accion:"Visita programada", detalle:"Control mensual", prioridad:2, ciudad:{id:1}})
accionService.update(1, {prioridad:1, status:true})
```

---

## 8. Módulo VISITADOR — `Api/internal/visitador/{models:5,routes:14,handlers:22}` ⚠️ Patrón distinto

**Modelo:** `Visitador:5` `{persona_id, nombre*, primer_apellido*, segundo_apellido?, sexo?, correo*, telefono?, ci?, activo bool, created_at}` — Extiende persona, `activo` = en terreno  
**Create:** `CreateVisitadorRequest:18` `{persona_id?, nombre*, primer_apellido*, segundo_apellido?, sexo?, correo*, telefono?, ci?}` — Handler crea `Activo=true` por defecto  
**Update:** `UpdateVisitadorRequest:29` `{nombre?, primer_apellido?, segundo_apellido?, telefono?, activo? *bool}` (sin `ci/sexo/correo`)  
**Tabla:** `docker/init.sql:112` `visitador (persona_id PK)`

**¡Todos requieren ADMIN, incluso GET!** (`routes.go:20-24` usa `wrap := auth(adminOnly)` + `TrimPrefix` para `/{id}`)

| Método | Path registrado | Handler | Path real Frontend |
|---|---|---|---|
| `GET` | `/api/visitadores` | `h.List:53` | `/api/visitadores` |
| `POST` | `/api/visitadores` | `h.Create:22` | `/api/visitadores` |
| `GET` | `/api/visitadores/` | `h.GetByID:63` `TrimPrefix "/api/visitadores/"` | `/api/visitadores/{id}` (con `/` final) |
| `PUT` | `/api/visitadores/` | `h.Update:85` → `{"message":"actualizado"}` | `/api/visitadores/{id}` |
| `DELETE` | `/api/visitadores/` | `h.Delete:112` → `{"message":"eliminado"}` | `/api/visitadores/{id}` |

```ts
// FE ya creado: src/modules/core/services/visitador.service.ts:7, src/modules/admin/views/Visitadores/Visitadores.tsx:32
visitadorService.list() // requiere token admin
visitadorService.create({nombre:"Juan", primer_apellido:"Pérez", correo:"j@praxis.com", telefono:"+56 9..."})
visitadorService.update(1, {telefono:"+591...", activo:true})
visitadorService.remove(1)
```

---

## 9. Matriz CRUD Resumen para Frontend

| Entidad | Create attrs* | Read | Update attrs | Delete | Auth | FE Service |
|---|---|---|---|---|---|---|
| Ciudad | `nombre*` | `GET /api/ciudades` + `/{id}` | `nombre, status` | `DELETE /{id}` | R púb, W admin | `ciudad.service.ts` |
| Especialidad | `nombre*, codigo*` | `GET /api/especialidades` | `nombre, codigo, status` | `DELETE` | R púb, W admin | `especialidad.service.ts` |
| Persona | `nombre*, primer_apellido*` + opcionales | `GET /api/personas` | todos + `status` | `DELETE` | R púb, W admin | `persona.service.ts` |
| Medico | `persona_id*, codigo*` + `institucion, direccion(JSON), especialidad_id, clasif, frec, notas` | `GET /api/medicos` | `codigo, institucion, direccion(JSON), status` | `DELETE /{persona_id}` | R púb, W admin | `medico.service.ts` |
| Accion | `nombre_accion*` + `ciudad(JSON), detalle, impacto, prioridad(0-3)` | `GET /api/acciones` | igual + `status` | `DELETE` | R púb, W admin | `accion.service.ts` |
| Visitador | `nombre*, primer_apellido*, correo*` | `GET /api/visitadores` | `nombre, primer_apellido, telefono, activo` | `DELETE` | **SI admin (incluso GET)** | `visitador.service.ts` |
| Auth | `email*, password*` | `POST /login` → `TokenResponse` | — | — | login púb, register admin | `auth.service.ts` |

`*` = requerido (validado en `handlers/*.go:27-30` → `400` si falta)

---

## 10. Ejemplos TypeScript Frontend (cómo jalar atributos)

**Cliente base** (`core/lib/api.ts:20`):
```ts
import { apiClient } from './modules/core/lib/api' // ya incluye Bearer
// GET público
const ciudades = await apiClient.get<Ciudad[]>('/api/ciudades', {auth:false})
// POST admin
await apiClient.post<Ciudad>('/api/ciudades', {nombre:"Cochabamba"})
// PUT admin
await apiClient.put<Ciudad>('/api/ciudades/1', {nombre:"La Paz", status:true})
// DELETE admin
await apiClient.del('/api/ciudades/1')
```

**Médico con dirección JSON (usado en MapPicker `admin/views/MedicosAdmin`):**
```ts
await medicoService.create({
  persona_id: 12,
  codigo: "MED-012",
  institucion: "Clínica Santa Fe",
  direccion: { direccion:"Av. Eloy Alfaro 3400", detalle:"Consultorio 204", coords:[-0.185,-78.472] },
  especialidad_id: 2,
  clasificacion: 4
})
```

**Visitador (admin):**
```ts
const token = (await authService.login({email:"admin@praxis.com", password:"admin123"})).token
// luego
await visitadorService.list() // ya lleva Authorization
```

---

## 11. Errores & Códigos

- `400 json inválido` / `400 nombre/codigo/email requeridos` (handlers validan campos `*`)
- `401 token requerido` / `token inválido o expirado` / `credenciales inválidas` (`middleware/auth.go:27`, `services/auth.go:65`)
- `403 sin permisos` (`RequireRole` `auth.go:71`, solo `role=="admin"` puede `POST/PUT/DELETE` y **todos** los visitador)
- `404 no encontrado` (handlers `GetByID` → `strconv.Atoi` + `404` si `TrimPrefix` no numérico en visitador `handlers/visitador.go:64`)

---

## 12. No implementado (tablas en DB pero sin endpoint — para futuro CRUD)

- `laboratorio`, `laboratorio_ciudad`, `visitador_medico` (`docker/init.sql:52,68,122`) — existen en DB pero no hay `Api/internal/laboratorio` ni `visitador_medico` routes. Si el FE necesita `LaboratoriosView` / `Historial` / `VisitRegistration`, hay que crear `Api/internal/laboratorio/handlers|routes` siguiendo patrón `ciudad`.

---

## 13. Archivos Clave

- **Backend entry:** `Api/cmd/api/main.go:46` `config.Load()` + `database.NewPool` + registro módulos + `middleware.CORS(mux)` → `http.Server Addr=":"+cfg.Port`
- **DB init:** `docker/init.sql:1` (ciudad, persona, especialidad, laboratorio, medico, accion, visitador, users)
- **Frontend env:** `praxis-crm-FR/.env.example:1` `VITE_API_URL`, `vite.config.ts:7` proxy, `nginx.conf:7` `proxy_pass praxis-api:8080`
- **Frontend auth:** `src/modules/auth/services/auth.service.ts:1`, `src/modules/core/lib/storage.ts:1`, `src/modules/auth/views/Login/Login.tsx:21`
- **Frontend services CRUD:** `src/modules/core/services/{ciudad,especialidad,persona,medico,accion,visitador}.service.ts`

> Para hacer CRUD en el frontend, jalá **exactamente** los atributos listados en `Create*Request` / `Update*Request` de cada `models/*.go` — el FE ya tiene wrappers listos en `core/services/` con fallback mock donde el BE no trae nombres (ver `Medicos.tsx:30` y `Visitadores.tsx:55`).
