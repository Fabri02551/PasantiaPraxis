import { apiClient } from '../lib/api'

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
  precios: (ciudadId?: number) =>
    apiClient.get<LaboratorioPrecioBE[]>(`/api/laboratorios/precios${ciudadId ? `?ciudad_id=${ciudadId}` : ''}`),
}