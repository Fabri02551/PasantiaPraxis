import { apiClient } from '../lib/api'

export type MedicoBE = {
  persona_id: number
  codigo: string
  especialidad_id?: number | null
  institucion?: string
  direccion?: unknown
  clasificacion?: number
  frecuencia_visita?: string
  notas?: unknown
  status: boolean
  created_at?: string
}

// Mapeo FE <-> BE: el FE usa Medico {id, nombre, especialidad, hospital, visitadorAsignado}
// El BE usa persona_id + codigo + especialidad_id + institucion + direccion JSON
export const medicoService = {
  list: () => apiClient.get<MedicoBE[]>('/api/medicos', { auth: false }),
  getById: (personaId: number) => apiClient.get<MedicoBE>(`/api/medicos/${personaId}`, { auth: false }),
  create: (data: { persona_id: number; codigo: string; especialidad_id?: number; institucion?: string; direccion?: unknown; clasificacion?: number; frecuencia_visita?: string; notas?: unknown }) =>
    apiClient.post<MedicoBE>('/api/medicos', data),
  update: (personaId: number, data: Partial<MedicoBE>) =>
    apiClient.put<MedicoBE>(`/api/medicos/${personaId}`, data),
  remove: (personaId: number) => apiClient.del<{ message: string }>(`/api/medicos/${personaId}`),
}
