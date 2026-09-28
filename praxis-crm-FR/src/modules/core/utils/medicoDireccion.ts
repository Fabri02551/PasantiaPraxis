/**
 * Helpers sobre `medico.direccion` (columna JSONB).
 *
 * La tabla `medico` no tiene columna `institucion`: el frontend guarda la
 * lista de ubicaciones (direccion, detalle, coords, hospital) dentro de ese
 * JSONB. Además, datos cargados antes de un fix pueden tenerlo guardado como
 * un string JSON en vez de un array, por eso `normalizeUbicaciones` acepta
 * ambas formas.
 */

export type UbicacionMedico = {
  id: string
  direccion: string
  detalle: string
  coords: [number, number]
  hospital?: string
}

export const DEFAULT_COORDS: [number, number] = [-0.1807, -78.4678]

const toUbicacion = (raw: unknown, index: number): UbicacionMedico => {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const coords = Array.isArray(o.coords) && o.coords.length === 2
    ? ([Number(o.coords[0]), Number(o.coords[1])] as [number, number])
    : DEFAULT_COORDS
  return {
    id: typeof o.id === 'string' ? o.id : `u${index}`,
    direccion: typeof o.direccion === 'string' ? o.direccion : (typeof o.hospital === 'string' ? o.hospital : ''),
    detalle: typeof o.detalle === 'string' ? o.detalle : '',
    coords: [Number.isFinite(coords[0]) ? coords[0] : DEFAULT_COORDS[0], Number.isFinite(coords[1]) ? coords[1] : DEFAULT_COORDS[1]],
    hospital: typeof o.hospital === 'string' ? o.hospital : undefined,
  }
}

const tieneDatos = (o: Record<string, unknown>): boolean =>
  typeof o.direccion === 'string' && o.direccion.trim() !== '' ||
  typeof o.hospital === 'string' && o.hospital.trim() !== '' ||
  typeof o.detalle === 'string' && o.detalle.trim() !== ''

export const normalizeUbicaciones = (raw: unknown): UbicacionMedico[] => {
  if (raw === null || raw === undefined || raw === '') return []
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed || (trimmed[0] !== '[' && trimmed[0] !== '{')) return []
    try { parsed = JSON.parse(trimmed) } catch { return [] }
  }
  if (Array.isArray(parsed)) return parsed.filter(u => tieneDatos((u ?? {}) as Record<string, unknown>)).map(toUbicacion)
  if (typeof parsed === 'object' && parsed !== null) {
    return tieneDatos(parsed as Record<string, unknown>) ? [toUbicacion(parsed, 0)] : []
  }
  return []
}

/** Nombre de la institución: el `hospital` de la 1ª ubicación, o su dirección. */
export const hospitalFromDireccion = (raw: unknown): string => {
  const [first] = normalizeUbicaciones(raw)
  if (!first) return ''
  return first.hospital || first.direccion || ''
}

/**
 * Primer texto de dirección que se encuentre en un JSONB que puede venir como
 * objeto {direccion|nombre|detalle}, array o string serializado (cargas viejas).
 * Pensado para `institucion.direccion`.
 */
export const firstDireccionTexto = (dir: unknown): string => {
  if (dir === null || dir === undefined || dir === '') return ''
  let parsed: unknown = dir
  if (typeof dir === 'string') {
    try {
      parsed = JSON.parse(dir)
    } catch {
      return dir
    }
  }
  const primero = (o: Record<string, unknown>): string =>
    (typeof o.direccion === 'string' && o.direccion.trim()) ||
    (typeof o.nombre === 'string' && o.nombre.trim()) ||
    (typeof o.detalle === 'string' && o.detalle.trim()) ||
    ''
  if (Array.isArray(parsed)) return primero((parsed[0] ?? {}) as Record<string, unknown>)
  if (typeof parsed === 'object' && parsed !== null) return primero(parsed as Record<string, unknown>)
  return ''
}
