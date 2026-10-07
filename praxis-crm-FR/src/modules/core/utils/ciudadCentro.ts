/**
 * Centro de cada ciudad del catálogo.
 *
 * El mapa de la ruta se centra en el centro de la ciudad del visitador, en
 * vez de encuadrar los pines: al encuadrar la ruta, si los destinos quedan
 * lejos entre sí, Leaflet aleja el mapa hasta mostrar el país entero y la
 * ciudad se pierde en un punto.
 *
 * Coordenadas aproximadas del centroide urbano, suficientes para elegir el
 * punto de arranque del mapa (no se usa para geocodificar direcciones, eso lo
 * hace el ETL).
 */
export const CENTROS_CIUDAD: Record<string, [number, number]> = {
  'la paz': [-16.5003, -68.1500],
  'el alto': [-16.5500, -68.1500],
  'santa cruz': [-17.7833, -63.1833],
  montero: [-17.3389, -63.2500],
  cochabamba: [-17.3895, -66.1568],
  quillacollo: [-17.2333, -66.2833],
  sacaba: [-17.2333, -66.2833],
  tiquipaya: [-17.5833, -66.2667],
  chapare: [-17.4000, -64.8000],
  punata: [-17.2333, -65.8500],
  cliza: [-17.1833, -65.8500],
  sucre: [-19.0333, -65.2667],
  tarija: [-21.5333, -64.7333],
  oruro: [-17.9667, -67.1167],
  potosi: [-19.5833, -65.7667],
  uyuni: [-20.4600, -66.8250],
  pando: [-11.1833, -68.7667],
  beni: [-14.8333, -64.9000],
  trinidad: [-14.8333, -64.9000],
  riberalta: [-11.0000, -66.0000],
  'villa montes': [-21.2500, -63.5000],
}

/** Sin acentos y en minúscula, para que "Cochabamba" y "cochabamba" den la misma clave. */
function clave(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Centro de la ciudad por su nombre, o null si no está en el catálogo. */
export function centroCiudad(nombre: string | null | undefined): [number, number] | null {
  if (!nombre) return null
  return CENTROS_CIUDAD[clave(nombre)] ?? null
}

/**
 * Punto medio de una lista de coordenadas. Es el respaldo cuando el visitador
 * no tiene ciudad cargada: la media de sus destinos cae dentro de la zona
 * donde trabaja, que es más útil que un pin suelto en la esquina del mapa.
 */
export function centroide(coords: [number, number][]): [number, number] | null {
  if (coords.length === 0) return null
  let lat = 0
  let lon = 0
  for (const [a, b] of coords) {
    lat += a
    lon += b
  }
  return [lat / coords.length, lon / coords.length]
}