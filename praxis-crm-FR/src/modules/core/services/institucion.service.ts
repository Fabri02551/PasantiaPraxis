import { apiClient } from '../lib/api'

// Refleja el struct Institucion del backend
// (Api/internal/institucion/models/institucion.go).
export type InstitucionBE = {
  id: number
  nombre: string
  razon_social: string
  direccion?: unknown
  telefono?: string
  correo?: string
  tipo_contrato?: string
  nit?: string
  visitador_id?: number | null
  ciudad_id?: number | null
  es_particular?: boolean
  clasificacion?: number
  status: boolean
  creado_por?: number | null
  modificado_por?: number | null
  fecha_creacion?: string
  ultima_modificacion?: string
}

export type CreateInstitucionPayload = {
  nombre: string
  razon_social?: string
  direccion?: unknown
  telefono?: string
  correo?: string
  tipo_contrato?: string
  nit?: string
  visitador_id?: number | null
  ciudad_id?: number | null
  es_particular?: boolean
  clasificacion?: number
}

export type UpdateInstitucionPayload = Partial<CreateInstitucionPayload> & { status?: boolean }

export type InstitucionPage = { total: number; page: number; limit: number; items: InstitucionBE[] }

export const institucionService = {
  // GET visible para admin y visitador (Api/internal/institucion/routes/routes.go)
  list: () => apiClient.get<InstitucionBE[]>('/api/instituciones'),
  page: (query: { page: number; limit: number; q?: string }) => {
    const p = new URLSearchParams({ page: String(query.page), limit: String(query.limit) })
    if (query.q) p.set('q', query.q)
    return apiClient.get<InstitucionPage>(`/api/instituciones?${p.toString()}`)
  },
  getById: (id: number) => apiClient.get<InstitucionBE>(`/api/instituciones/${id}`),
  // Escritura exclusiva de admin
  create: (data: CreateInstitucionPayload) => apiClient.post<InstitucionBE>('/api/instituciones', data),
  update: (id: number, data: UpdateInstitucionPayload) =>
    apiClient.put<InstitucionBE>(`/api/instituciones/${id}`, data),
  remove: (id: number) => apiClient.del<{ message: string }>(`/api/instituciones/${id}`),
}