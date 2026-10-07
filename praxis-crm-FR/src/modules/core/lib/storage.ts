const TOKEN_KEY = 'praxis_token'
const ROLE_KEY = 'praxis_role'
const USER_KEY = 'praxis_user'
const UBICACION_KEY = 'praxis_ubicacion'
const NOTIS_VISTAS_KEY = 'praxis_notificaciones_vistas'

/** Posición del visitador guardada al iniciar sesión (ver App.tsx). */
export type UbicacionGuardada = {
  latitud: number
  longitud: number
  precisionM: number | null
  /** Momento de la lectura, ISO. */
  tomadaEn: string
}

export const storage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  getRole: () => localStorage.getItem(ROLE_KEY) as 'admin' | 'visitador' | null,
  setRole: (r: string) => localStorage.setItem(ROLE_KEY, r),
  getUser: () => {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  setUser: (u: unknown) => localStorage.setItem(USER_KEY, JSON.stringify(u)),
  getUbicacion: (): UbicacionGuardada | null => {
    try {
      const raw = localStorage.getItem(UBICACION_KEY)
      if (!raw) return null
      const u = JSON.parse(raw)
      if (!Number.isFinite(u?.latitud) || !Number.isFinite(u?.longitud)) return null
      return u
    } catch {
      return null
    }
  },
  setUbicacion: (u: UbicacionGuardada) => localStorage.setItem(UBICACION_KEY, JSON.stringify(u)),
  /** Ids de las notificaciones que el visitador ya abrió. */
  getNotificacionesVistas: (): string[] => {
    try {
      const raw = localStorage.getItem(NOTIS_VISTAS_KEY)
      if (!raw) return []
      const v = JSON.parse(raw)
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return []
    }
  },
  setNotificacionesVistas: (ids: string[]) =>
    localStorage.setItem(NOTIS_VISTAS_KEY, JSON.stringify(ids.slice(-300))),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(UBICACION_KEY)
    localStorage.removeItem(NOTIS_VISTAS_KEY)
  },
}
