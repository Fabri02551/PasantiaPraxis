/**
 * Config central de entorno - expone VITE_API_URL
 *
 * API_URL va VACÍA a propósito: el cliente `api()` arma `${API_URL}${path}`, y
 * con la variable vacía la petición sale como `/api/visitas`, o sea al MISMO
 * origen desde el que se sirvió la app.
 *
 * Eso es lo que hace funcionar el GPS del visitador. La API de geolocalización
 * del navegador solo se entrega en un contexto seguro: HTTPS o localhost. Con
 * la app en HTTPS, pedir `http://api-praxis:8080` es contenido mixto y el
 * navegador lo bloquea antes de mostrar el permiso. Con la ruta relativa no hay
 * mezcla: el nginx de la misma app termina el TLS y hace de proxy.
 *
 * Solo hace falta un valor absoluto en desarrollo con `npm run dev`, donde Vite
 * corre en 5173 y el proxy de vite.config.ts ya reenvía /api al backend.
 */
export const ENV = {
  API_URL: import.meta.env.VITE_API_URL?.toString().replace(/\/$/, '') ?? '',
  MAP_TILE_URL:
    import.meta.env.VITE_MAP_TILE_URL?.toString() || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
} as const

export const getApiUrl = () => ENV.API_URL

/**
 * Texto para mostrarle a la persona dónde está la API. Con API_URL vacía no
 * hay URL que mostrar, pero sí conviene aclarar que es el mismo origen.
 */
export const API_LABEL = ENV.API_URL || `${location.origin} (mismo origen)`

