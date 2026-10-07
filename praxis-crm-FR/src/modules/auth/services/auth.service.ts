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

// Refleja ProfileResponse del backend (Api/internal/auth/models/auth.go).
// `nacimiento` llega como timestamp RFC3339 porque persona.nacimiento es DATE.
export type CurrentUser = {
  id: string
  persona_id: number | null
  email: string
  role: 'admin' | 'visitador'
  nombre: string
  primer_apellido: string
  segundo_apellido: string | null
  sexo: string
  correo: string
  telefono: string
  nacimiento: string | null
  ci: string
  created_at: string
}

export type UpdateProfilePayload = {
  nombre: string
  primer_apellido: string
  segundo_apellido: string | null
  sexo: string
  telefono: string
  nacimiento: string | null
  ci: string
}

export type ForgotPasswordRequest = {
  email: string
  app_url: string
}

export type ResetPasswordRequest = {
  token: string
  password: string
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
  getMe: () => apiClient.get<CurrentUser>('/api/auth/me'),
  updateMe: (payload: UpdateProfilePayload) => apiClient.put<CurrentUser>('/api/auth/me', payload),
  forgotPassword: (email: string, appUrl: string) =>
    apiClient.post<{ message: string }>('/api/auth/forgot-password', { email, app_url: appUrl }, { auth: false }),
  resetPassword: (token: string, password: string) =>
    apiClient.post<{ message: string }>('/api/auth/reset-password', { token, password }, { auth: false }),
  logout: () => storage.clear(),
  isAuthenticated: () => !!storage.getToken(),
  getRole: () => storage.getRole(),
}
