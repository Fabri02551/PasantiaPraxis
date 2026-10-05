import { apiClient } from '../lib/api'

// Refleja el struct Laboratorio del backend
// (Api/internal/laboratorio/models/laboratorio.go).
export type CostoCiudad = {
  ciudad_id: number
  ciudad: string
  costo: number
}

export type LaboratorioBE = {
  id: number
  nombre: string
  area: string
  precio: number
  comision_extra?: number
  status: boolean
  costos_ciudad?: CostoCiudad[] | string
  creado_por?: number | null
  modificado_por?: number | null
  fecha_creacion?: string
  ultima_modificacion?: string
}

export type CreateLaboratorioPayload = {
  nombre: string
  area: string
  precio: number
  comision_extra?: number
}

export type UpdateLaboratorioPayload = Partial<CreateLaboratorioPayload> & { status?: boolean }

// Refleja LaboratorioPrecio del backend (Api/internal/laboratorio).
// GET /api/laboratorios/precios?ciudad_id=N — auth admin o visitador.
export type LaboratorioPrecioBE = {
  id: number
  nombre: string
  area: string
  costo: number
  comision_extra: number
}

export const laboratorioService = {
  // GET públicos; escritura exclusiva de admin
  // (Api/internal/laboratorio/routes/routes.go)
  list: () => apiClient.get<LaboratorioBE[]>('/api/laboratorios'),
  getById: (id: number) => apiClient.get<LaboratorioBE>(`/api/laboratorios/${id}`),
  create: (data: CreateLaboratorioPayload) => apiClient.post<LaboratorioBE>('/api/laboratorios', data),
  update: (id: number, data: UpdateLaboratorioPayload) =>
    apiClient.put<LaboratorioBE>(`/api/laboratorios/${id}`, data),
  remove: (id: number) => apiClient.del<{ message: string }>(`/api/laboratorios/${id}`),
  // Precios para la cotización del visitador (con o sin ciudad).
  precios: (ciudadId?: number) =>
    apiClient.get<LaboratorioPrecioBE[]>(`/api/laboratorios/precios${ciudadId ? `?ciudad_id=${ciudadId}` : ''}`),
}
