import { apiClient } from '../lib/api'

export type VisitadorBE = {
  persona_id: number
  nombre: string
  primer_apellido: string
  segundo_apellido?: string | null
  sexo?: string
  correo: string
  telefono?: string
  ci?: string
  activo: boolean
  created_at: string
}

export const visitadorService = {
  // Nota BE: todos requieren auth admin (Api/internal/visitador/routes/routes.go:20-24)
  list: () => apiClient.get<VisitadorBE[]>('/api/visitadores'),
  getById: (id: number) => apiClient.get<VisitadorBE>(`/api/visitadores/${id}`),
  create: (data: { nombre: string; primer_apellido: string; segundo_apellido?: string; sexo?: string; correo: string; telefono?: string; ci?: string; persona_id?: number }) =>
    apiClient.post<VisitadorBE>('/api/visitadores', data),
  update: (id: number, data: { nombre?: string; primer_apellido?: string; segundo_apellido?: string; telefono?: string; activo?: boolean }) =>
    apiClient.put<{ message: string }>(`/api/visitadores/${id}`, data),
  remove: (id: number) => apiClient.del<{ message: string }>(`/api/visitadores/${id}`),
}
