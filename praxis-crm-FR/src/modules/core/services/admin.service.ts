import { apiClient } from '../lib/api'

// Refleja AdminItem del backend (Api/internal/auth/models/auth.go).
// status: true(1)=activo, false(0)=eliminado lógico.
export type AdminBE = {
  id: string
  persona_id: number
  email: string
  role: string
  nombre: string
  primer_apellido: string
  segundo_apellido?: string | null
  sexo: string
  correo: string
  telefono: string
  nacimiento?: string | null
  ci: string
  ciudad_id?: number | null
  status: boolean
  created_at?: string
}

export type CreateAdminPayload = {
  email: string
  password: string
  nombre: string
  primer_apellido: string
  segundo_apellido?: string
  sexo: string
  telefono?: string
  ci?: string
  ciudad_id?: number | null
  nacimiento?: string | null
}

export type UpdateAdminPayload = {
  nombre?: string
  primer_apellido?: string
  segundo_apellido?: string | null
  sexo?: string
  telefono?: string
  ci?: string
  ciudad_id?: number | null
  nacimiento?: string | null
  correo?: string
  email?: string
  password?: string
  status?: boolean
}

export const adminService = {
  // CRUD completo, solo rol admin (Api/internal/auth/routes/routes.go)
  list: () => apiClient.get<AdminBE[]>('/api/admins'),
  getById: (personaId: number) => apiClient.get<AdminBE>(`/api/admins/${personaId}`),
  create: (data: CreateAdminPayload) => apiClient.post<AdminBE>('/api/admins', data),
  update: (personaId: number, data: UpdateAdminPayload) =>
    apiClient.put<AdminBE>(`/api/admins/${personaId}`, data),
  // Eliminación LÓGICA: persona.status 1 -> 0, no borra filas
  remove: (personaId: number) => apiClient.del<{ message: string }>(`/api/admins/${personaId}`),
}
