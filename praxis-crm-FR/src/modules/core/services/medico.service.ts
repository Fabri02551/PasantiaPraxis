import { apiClient } from '../lib/api'

// Refleja el struct Medico del backend (Api/internal/medico/models/medico.go).
// Ojo: la tabla medico NO tiene columna `institucion` ni `created_at`;
// el nombre del médico vive en `persona` y hay que pedirlo a /api/personas/{id}.
export type MedicoBE = {
  persona_id: number
  matricula: string
  codigo?: string | null
  especialidad_id: number
  visitador_id?: number | null
  es_particular?: boolean
  direccion?: unknown
  clasificacion?: number
  frecuencia_visita?: string
  notas?: unknown
  status: boolean
  creado_por?: number | null
  modificado_por?: number | null
  fecha_creacion?: string
  ultima_modificacion?: string
}

// `direccion` y `notas` son columnas JSONB: hay que mandar el objeto/array
// ya parseado, nunca un JSON.stringify (eso se guardaría como un string JSON
// y la vista no lo puede leer).
// Datos de la persona base del médico. Si viene anidada, el backend inserta
// persona + médico en la MISMA transacción: si algo falla no queda la persona
// huérfana. Por eso el alta es un solo POST y no dos.
export type PersonaMedicoInput = {
  nombre: string
  primer_apellido: string
  segundo_apellido?: string
  sexo: string
  correo?: string
  telefono?: string
  ci?: string
  ciudad_id?: number | null
}

export type CreateMedicoPayload = {
  matricula: string
  especialidad_id: number
  persona?: PersonaMedicoInput
  persona_id?: number
  codigo?: string
  visitador_id?: number | null
  es_particular?: boolean
  direccion?: unknown
  clasificacion?: number
  frecuencia_visita?: string
  notas?: unknown
}

export type UpdateMedicoPayload = {
  matricula?: string
  especialidad_id?: number | null
  codigo?: string
  visitador_id?: number | null
  es_particular?: boolean
  direccion?: unknown
  clasificacion?: number
  frecuencia_visita?: string
  notas?: unknown
  status?: boolean
}

// Mapeo FE <-> BE: el FE usa Medico {id, nombre, especialidad, hospital, ...}
// El BE usa persona_id + matricula + especialidad_id + direccion JSONB
export const medicoService = {
  list: () => apiClient.get<MedicoBE[]>('/api/medicos', { auth: false }),
  getById: (personaId: number) => apiClient.get<MedicoBE>(`/api/medicos/${personaId}`, { auth: false }),
  create: (data: CreateMedicoPayload) => apiClient.post<MedicoBE>('/api/medicos', data),
  update: (personaId: number, data: UpdateMedicoPayload) => apiClient.put<MedicoBE>(`/api/medicos/${personaId}`, data),
  remove: (personaId: number) => apiClient.del<{ message: string }>(`/api/medicos/${personaId}`),
}
