/**
 * Helpers sobre `medico.direccion` y `institucion.direccion` (columnas JSONB).
 *
 * La tabla `medico` no tiene columna `institucion`: el frontend guarda la
 * lista de ubicaciones (direccion, detalle, coords, hospital) dentro de ese
 * JSONB. Además, datos cargados antes de un fix pueden tenerlo guardado como
 * un string JSON en vez de un array, por eso `normalizeUbicaciones` acepta
 * ambas formas.
 *
 * `coords` es nullable a propósito, y ya no hay ninguna constante de respaldo.
 * Antes, una ubicación sin pin heredaba DEFAULT_COORDS (Quito), así que un
 * médico sin geocodificar aparecía en el mapa sobre una calle de la capital.
 * Era peor que no mostrar nada: se veía un pin y se leía como "acá está". Ahora
 * la ausencia de pin se representa como null y cada vista decide qué mostrar.
 */

export type UbicacionMedico = {
  id: string
  direccion: string
  detalle: string
  /** null cuando la ubicación todavía no fue geocodificada. */
  coords: [number, number] | null
  hospital?: string
}

/**
 * Extrae un [lat, lon] válido, o null.
 *
 * Rechaza lo que no sirve: arrays de otra longitud, valores no numéricos, y
 * (0, 0), que es el punto que el DEFAULT_COORDS usaba y que cae en medio del
 * océano. Un (0,0) guardado es un bug heredado, no una ubicación.
 */
const leerCoords = (raw: unknown): [number, number] | null => {
  if (!Array.isArray(raw) || raw.length !== 2) return null
  const lat = Number(raw[0])
  const lon = Number(raw[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  if (lat === 0 && lon === 0) return null
  return [lat, lon]
}

const toUbicacion = (raw: unknown, index: number): UbicacionMedico => {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    id: typeof o.id === 'string' ? o.id : `u${index}`,
    direccion: typeof o.direccion === 'string' ? o.direccion : (typeof o.hospital === 'string' ? o.hospital : ''),
    detalle: typeof o.detalle === 'string' ? o.detalle : '',
    coords: leerCoords(o.coords),
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

/**
 * Coordenadas de la ubicación elegida, o null si no hay pin.
 *
 * Es el accessor que debería usar casi todo: las vistas piden "dame el punto"
 * y con esto eligen entre mostrar el mapa o mostrar que no hay.
 */
export const coordsDe = (u: UbicacionMedico | null | undefined): [number, number] | null =>
  u?.coords ?? null

/** Si la ubicación tiene pin utilizable en el mapa. */
export const tieneCoords = (u: UbicacionMedico | null | undefined): boolean =>
  Array.isArray(u?.coords) && u.coords.length === 2

/** Primera ubicación que tenga pin, o null si ninguna tiene. */
export const primeraConCoords = (us: UbicacionMedico[]): UbicacionMedico | null =>
  us.find((u) => tieneCoords(u)) ?? null

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
