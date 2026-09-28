import { apiClient } from '../lib/api'

// Refleja VisitarequestCreate del backend
// (Api/internal/visita/models/visita.go -> CreateVisitaRequest).
export type CrearVisitaPayload = {
  id_visitador: number
  id_medico?: number | null
  institucion_id?: number | null
  fecha_visita_tentativa: string // RFC3339/ISO con hora (timestamp)
}

// Respuesta de GET /api/visitas (Api/internal/visita/models/visita.go).
export type VisitaBE = {
  id: number
  id_visitador: number
  id_medico?: number | null
  institucion_id?: number | null
  fecha_visita?: string | null
  fecha_visita_tentativa?: string | null
  latitud?: number | null
  longitud?: number | null
  firma?: string
  observacion?: unknown
  satisfaccion?: number
  duracion?: number
  ingreso?: number
  papeleta?: number
  registrada?: boolean
  estado?: string // 'por_visitar' | 'realizada'
}

export type VisitaLaboratorioBE = {
  laboratorio_id: number
  nombre: string
  area: string
  costo: number
  cantidad: number
}

export type AddLaboratorioPayload = { laboratorio_id: number; cantidad: number }

export type RegistrarVisitaPayload = {
  fecha_visita: string
  latitud?: number | null
  longitud?: number | null
  firma?: string
  observacion?: unknown
  satisfaccion?: number
  duracion?: number
  papeleta?: number
}

export const visitaService = {
  // GET autenticado (admin/admin o visitador): lista de visitas.
  list: () => apiClient.get<VisitaBE[]>('/api/visitas'),
  getById: (id: number) => apiClient.get<VisitaBE>(`/api/visitas/${id}`),
  // POST abierto a visitador: la API fuerza id_visitador = persona_id del token.
  crear: (payload: CrearVisitaPayload) => apiClient.post<VisitaBE>('/api/visitas', payload),
  // POST /api/visitas/{id}/registrar — el visitador llena la visita real.
  registrar: (id: number, payload: RegistrarVisitaPayload) =>
    apiClient.post<VisitaBE>(`/api/visitas/${id}/registrar`, payload),
  // Estudios de la cotización (GET/POST/DELETE, admin o visitador).
  getLaboratorios: (id: number) => apiClient.get<VisitaLaboratorioBE[]>(`/api/visitas/${id}/laboratorios`),
  addLaboratorios: (id: number, items: AddLaboratorioPayload[]) =>
    apiClient.post<VisitaLaboratorioBE[]>(`/api/visitas/${id}/laboratorios`, { laboratorios: items }),
  removeLaboratorio: (id: number, labId: number) =>
    apiClient.del<VisitaLaboratorioBE[]>(`/api/visitas/${id}/laboratorios/${labId}`),
}