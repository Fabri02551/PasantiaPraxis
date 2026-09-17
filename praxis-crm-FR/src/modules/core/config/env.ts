/**
 * Config central de entorno - expone VITE_API_URL
 * Backend por defecto: http://localhost:8080 (docker-compose.yml:28 + Api/internal/core/config/config.go:18)
 */
export const ENV = {
  API_URL: import.meta.env.VITE_API_URL?.toString().replace(/\/$/, '') || 'http://localhost:8080',
  MAP_TILE_URL:
    import.meta.env.VITE_MAP_TILE_URL?.toString() || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
} as const

export const getApiUrl = () => ENV.API_URL
