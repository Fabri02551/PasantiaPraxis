import { ENV } from '../config/env'
import { storage } from './storage'

type ApiOptions = RequestInit & { auth?: boolean; rawResponse?: boolean }

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

/**
 * Cliente centralizado - envuelve fetch con base URL, JWT y manejo de errores
 * Compatible con Api/internal/core/pkg/response/response.go -> {error: string} y JSON normal
 */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { auth = true, rawResponse = false, headers, ...rest } = opts
  const url = path.startsWith('http') ? path : `${ENV.API_URL}${path.startsWith('/') ? '' : '/'}${path}`

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  }

  if (auth) {
    const token = storage.getToken()
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, {
    ...rest,
    headers: finalHeaders,
  })

  if (rawResponse) return res as unknown as T

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    // El token expiró (o se volvió inválido): obligar a volver al login para
    // renovarlo. Solo aplica a llamadas autenticadas; una respuesta 401 del
    // login (credenciales malas / `auth:false`) no debe redirigir. La app es
    // SPA sin router: forzamos un reload y App arranca en 'login' porque
    // storage quedó vacío.
    if (res.status === 401 && auth) {
      const habiaSesion = !!storage.getToken()
      storage.clear()
      if (habiaSesion) {
        window.location.replace('/')
        // Espera el reload; nunca llegamos abajo.
        throw new ApiError('Sesión expirada. Volvé a iniciar sesión.', 401, data)
      }
    }
    const msg =
      (data as { error?: string })?.error ||
      (data as { message?: string })?.message ||
      `Error ${res.status}: ${res.statusText}`
    throw new ApiError(msg, res.status, data)
  }

  return data as T
}

export const apiClient = {
  get: <T>(path: string, opts?: ApiOptions) => api<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    api<T>(path, { ...opts, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown, opts?: ApiOptions) =>
    api<T>(path, { ...opts, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string, opts?: ApiOptions) => api<T>(path, { ...opts, method: 'DELETE' }),
  health: () => api<{ status: string }>('/health', { auth: false }),
}
