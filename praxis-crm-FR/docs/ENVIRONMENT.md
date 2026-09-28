# Configuración del Entorno — Praxis CRM FE

> Documento de configuración del entorno hasta el hito **"Primeras ventanas realizadas"** (rama `develop`).

## 1. Stack y Versiones

| Componente | Versión | Notas |
|---|---|---|
| **Node.js** | `24.19.0` (recomendado >= 20) | `nvm` disponible en `v24.19.0` |
| **npm** | `12.0.2` | lockfile `package-lock.json` commiteado |
| **Vite** | `8.2.2` | `vite.config.ts` + `@vitejs/plugin-react 6.1.0` |
| **React** | `19.2.8` | + `react-dom 19.2.8`, `react-leaflet 5.0.0` |
| **Leaflet** | `1.9.4` | Mapa OpenStreetMap, tipos `@types/leaflet 1.9.22` |
| **TypeScript** | `6.0.2` | `tsconfig.json` con referencias `app` / `node` |
| **Linter** | `oxlint 1.79.0` | Config `.oxlintrc.json` (react + typescript) |
| **Docker** | `node:22-alpine` build + `nginx:alpine` prod | `Dockerfile` + `nginx.conf` SPA fallback |

No se requieren variables de entorno en esta etapa. Si se añaden, usar `.env.example` como plantilla (ver § 3).

## 2. Requisitos Previos

```bash
# Node via nvm (opcional)
nvm install 24 && nvm use 24
node -v  # v24.19.0
npm -v   # 12.0.2

# Verificar herramientas
npx tsc --version
npx vite --version
```

Puertos usados:
- **5173** — `vite dev` (HMR)
- **80** — `nginx` en Docker

## 3. Variables de Entorno

Actualmente no hay variables. Para futuro:

```bash
cp .env.example .env  # cuando exista
```

`.env.example` sugerido:

```
VITE_API_URL=http://localhost:3000
VITE_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

 Todas las variables de Vite deben iniciar con `VITE_` para ser expuestas al cliente.

## 4. Instalación y Scripts

```bash
git clone git@gitlab.com:labpraxis/praxis-crm-fe.git
git checkout develop
npm ci          # instalación limpia desde lockfile
npm run dev     # http://localhost:5173  (host 0.0.0.0)
npm run build   # tsc -b && vite build → dist/
npm run preview # previsualiza dist/
npm run lint    # oxlint
```

Docker:

```bash
docker build -t praxis-crm-fe .
docker run -p 80:80 praxis-crm-fe
# → aplica nginx.conf (SPA fallback + cache 1y para /assets)
```

## 5. Estructura de Carpetas (vigente)

```
src/
├── assets/                     # hero.png, react.svg, vite.svg
├── modules/
│   ├── core/
│   │   ├── components/
│   │   ├── design-system/Button.tsx
│   │   ├── hooks/ lib/ utils/
│   ├── auth/
│   │   ├── components/ SignUpForm.tsx (+ re-export LoginForm)
│   │   ├── views/Login/Login.tsx + Login.css  # Praxis / Laboratorio clínico
│   │   ├── hooks/useAuth.ts
│   │   ├── lib/ services/ states/ utils/
│   ├── admin/
│   │   └── components/ Home, Calendar, Profile, Notifications (placeholder)
│   └── visitador/
│       ├── components/SidebarMenu/ SidebarMenu.tsx + .css  # Drawer animado
│       ├── views/
│       │   ├── Home/Home.tsx + Home.css          # Ruta del Día + OpenStreetMap Leaflet
│       │   ├── VisitRegistration/VisitRegistration.tsx + .css  # Firma canvas + foto
│       │   ├── Calendar/Calendar.tsx + .css      # Octubre 2026, visitas 2/8/12/18
│       │   ├── Profile/Profile.tsx + Profile.css # Mi Perfil (Carlos Mendoza)
│       │   └── Notifications/Notifications.tsx + .css # Bandeja 7 ítems, 3 nuevas
│       ├── hooks/ lib/ services/ states/ utils/
│       └── components/ (legacy Calendar/Profile/Notifications placeholders)
├── App.tsx                     # Router por estado View → login/home/registro/calendario/perfil/notificaciones/planificador
├── main.tsx
└── index.css / App.css
```

Cada vista reside en `views/<Vista>/` con **`.tsx` + `.css` co-localizados** (responsive móvil-first, escala a 720-760px en desktop).

## 6. Dependencias Clave

`package.json` dependencias actuales:

```json
{
  "dependencies": {
    "leaflet": "^1.9.4",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-leaflet": "^5.0.0"
  }
}
```

Leaflet requiere `import 'leaflet/dist/leaflet.css'` y fix de iconos en Vite (`delete L.Icon.Default.prototype._getIconUrl`).

## 7. Credenciales Provisionales

Login validado en `src/modules/auth/views/Login/Login.tsx:14`:

```
Usuario: visitador@praxis.com
Contraseña: visitador123
```

El formulario normaliza `email.trim().toLowerCase()` y muestra `.login-error` si no coincide. Hint visible bajo el botón.

## 8. Mapa — OpenStreetMap

- `TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"`
- Centro por defecto: `[-0.1807, -78.4678]` (Quito, Parque Metropolitano).
- Ruta con `Polyline` y 4 `Marker` con `divIcon` coloreado (amarillo/teal/rojo/azul), `Popup` con detalle.
- `scrollWheelZoom={false}`, `zoomControl={false}` para móvil.

## 9. Navegación y Estado

`App.tsx` gestiona `View` sin router externo:

```ts
type View = 'login' | 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones'
```

- `Login → home` tras credenciales válidas
- `Home → registro / calendario` vía botones y `Ver todo`
- `Header campana (notification-btn)` → `notificaciones`
- `SidebarMenu` (3 barras, `translateX -100%→0` + backdrop `opacity 0→1`, 300ms) → `Inicio`/`Ruta del Día`→`home`, `Registrar Visita`→`registro`, `Calendario`→`calendario`, `Mi Perfil`→`perfil`, `Planificador` placeholder, `Cerrar Sesión`→`login`.

## 10. Git — Ramas

- `main` — estable
- `develop` — activa (commit actual `Primeras ventanas realizadas`)
- Push: `git push origin develop` (SSH `git@gitlab.com:labpraxis/praxis-crm-fe.git`)

Ver log: `git log --oneline develop`

## 11. Próximos Pasos Sugeridos

- Añadir `react-router-dom` si se requiere URL routing / deep linking.
- Extraer `View` a `src/modules/core/lib/navigation.ts` para evitar duplicación de union types.
- Centralizar header y bell en `src/modules/core/components/AppHeader`.
- Env vars de API y protección de login real (JWT / backend).

---
*Generado 2026-08-26 — Praxis Laboratorio Clínico — FieldCRM visitador*
