import { apiClient } from '../lib/api'

export type Persona = {
  id: number
  nombre: string
  primer_apellido: string
  segundo_apellido?: string | null
  sexo?: string
  correo?: string
  telefono?: string
  nacimiento?: string | null
  ci?: string
  ciudad_id?: number | null
  status: boolean
  created_at?: string
}

export const personaService = {
  list: () => apiClient.get<Persona[]>('/api/personas', { auth: false }),
  getById: (id: number) => apiClient.get<Persona>(`/api/personas/${id}`, { auth: false }),
  create: (data: Omit<Persona, 'id' | 'status' | 'created_at'>) =>
    apiClient.post<Persona>('/api/personas', data),
  update: (id: number, data: Partial<Persona>) => apiClient.put<Persona>(`/api/personas/${id}`, data),
  remove: (id: number) => apiClient.del<{ message: string }>(`/api/personas/${id}`),
}
