import { apiClient } from '../lib/api'

export type Ciudad = { id: number; nombre: string; status: boolean; created_at?: string }

export const ciudadService = {
  list: () => apiClient.get<Ciudad[]>('/api/ciudades', { auth: false }),
  getById: (id: number) => apiClient.get<Ciudad>(`/api/ciudades/${id}`, { auth: false }),
  create: (data: { nombre: string }) => apiClient.post<Ciudad>('/api/ciudades', data),
  update: (id: number, data: { nombre?: string; status?: boolean }) =>
    apiClient.put<Ciudad>(`/api/ciudades/${id}`, data),
  remove: (id: number) => apiClient.del<{ message: string }>(`/api/ciudades/${id}`),
}
