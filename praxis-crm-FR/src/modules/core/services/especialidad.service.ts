import { apiClient } from '../lib/api'

export type Especialidad = { id: number; nombre: string; codigo: string; status: boolean; created_at?: string }

export const especialidadService = {
  list: () => apiClient.get<Especialidad[]>('/api/especialidades', { auth: false }),
  getById: (id: number) => apiClient.get<Especialidad>(`/api/especialidades/${id}`, { auth: false }),
  create: (data: { nombre: string; codigo: string }) =>
    apiClient.post<Especialidad>('/api/especialidades', data),
  update: (id: number, data: { nombre?: string; codigo?: string; status?: boolean }) =>
    apiClient.put<Especialidad>(`/api/especialidades/${id}`, data),
  remove: (id: number) => apiClient.del<{ message: string }>(`/api/especialidades/${id}`),
}
