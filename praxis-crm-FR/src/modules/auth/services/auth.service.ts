import { apiClient } from '../../core/lib/api'
import { storage } from '../../core/lib/storage'

export type LoginRequest = { email: string; password: string }
export type TokenResponse = { token: string; token_type: string; expires_in: number; role: string }
export type RegisterRequest = {
  email: string
  password: string
  role?: string
  nombre: string
  primer_apellido: string
  segundo_apellido?: string
  sexo?: string
  telefono?: string
  ci?: string
}

export const authService = {
  login: async (req: LoginRequest) => {
    const res = await apiClient.post<TokenResponse>('/api/auth/login', req, { auth: false })
    storage.setToken(res.token)
    storage.setRole(res.role)
    storage.setUser({ email: req.email, role: res.role })
    return res
  },
  register: async (req: RegisterRequest) => {
    return apiClient.post<TokenResponse>('/api/auth/register', req, { auth: true })
  },
  logout: () => storage.clear(),
  isAuthenticated: () => !!storage.getToken(),
  getRole: () => storage.getRole(),
}
