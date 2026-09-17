import { apiClient } from '../lib/api'

export type Accion = {
  id: number
  nombre_accion: string
  ciudad?: unknown
  detalle?: string
  impacto_esperado?: string
  prioridad?: number
  status: boolean
  created_at?: string
}

export const accionService = {
  list: () => apiClient.get<Accion[]>('/api/acciones', { auth: false }),
  getById: (id: number) => apiClient.get<Accion>(`/api/acciones/${id}`, { auth: false }),
  create: (data: { nombre_accion: string; ciudad?: unknown; detalle?: string; impacto_esperado?: string; prioridad?: number }) =>
    apiClient.post<Accion>('/api/acciones', data),
  update: (id: number, data: Partial<Accion>) => apiClient.put<Accion>(`/api/acciones/${id}`, data),
  remove: (id: number) => apiClient.del<{ message: string }>(`/api/acciones/${id}`),
}
