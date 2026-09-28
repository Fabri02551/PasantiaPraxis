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

export const institucionService = {
  // GET visible para admin y visitador (Api/internal/institucion/routes/routes.go)
  list: () => apiClient.get<InstitucionBE[]>('/api/instituciones'),
  getById: (id: number) => apiClient.get<InstitucionBE>(`/api/instituciones/${id}`),
}