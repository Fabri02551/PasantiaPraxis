import { apiClient } from '../lib/api'

// Refleja VisitarequestCreate del backend
// (Api/internal/visita/models/visita.go -> CreateVisitaRequest).
export type CrearVisitaPayload = {
  id_visitador: number
  id_medico?: number | null
  institucion_id?: number | null
  /**
   * Requerida para las visitas programadas. Una extraordinaria se crea SIN
   * fecha tentativa y con extraordinaria=true: el backend la valida.
   */
  fecha_visita_tentativa?: string | null
  /** Visita extraordinaria: se registra en campo de inmediato. */
  extraordinaria?: boolean
  /** Qué ubicación del médico/institución se visitó (id dentro de direccion[]). */
  ubicacion_destino_id?: string | null
}

// Respuesta de GET /api/visitas (Api/internal/visita/models/visita.go).
export type VisitaBE = {
  id: number
  id_visitador: number
  id_medico?: number | null
  institucion_id?: number | null
  fecha_visita?: string | null
  fecha_visita_tentativa?: string | null
  /** GPS del visitador al registrar. */
  latitud?: number | null
  longitud?: number | null
  gps_precision_m?: number | null
  /** Distancia en metros entre el GPS del visitador y el pin del destino. */
  distancia_destino_m?: number | null
  /** true cuando se registró sin GPS: queda para revisión. */
  sin_evidencia_ubicacion?: boolean
  ubicacion_destino_id?: string | null
  destino_direccion?: string | null
  destino_latitud?: number | null
  destino_longitud?: number | null
  firma?: string
  observacion?: unknown
  satisfaccion?: number
  duracion?: number
  ingreso?: number
  papeleta?: number
  registrada?: boolean
  estado?: string // 'por_visitar' | 'realizada'
  extraordinaria?: boolean
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
  /** GPS del visitador. Opcional: si falta, se registra con sin_evidencia_ubicacion. */
  latitud?: number | null
  longitud?: number | null
  /** Metros de precisión del GPS. Null si el navegador no la informó. */
  gps_precision_m?: number | null
  /** Id de la ubicación del destino que se visitó. */
  ubicacion_destino_id?: string | null
  /** Snapshot de esa ubicación, para que la visita guarde a dónde se fue. */
  destino_direccion?: string | null
  destino_latitud?: number | null
  destino_longitud?: number | null
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