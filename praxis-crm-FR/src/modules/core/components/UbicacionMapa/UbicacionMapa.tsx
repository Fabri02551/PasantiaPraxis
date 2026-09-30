import { MapContainer, TileLayer, Marker, Circle, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ENV } from '../../config/env'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import './UbicacionMapa.css'

// Fix del ícono por defecto de Leaflet con Vite: sin esto los marcadores
// salen como cuadros rotos porque el bundler no resuelve las rutas que
// Leaflet arma con una concatenación de strings.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

export type Coord = [number, number]

export type UbicacionMapaProps = {
  /** Dónde está el destino. Si falta, el mapa se dibuja centrado en el visitador. */
  destino?: Coord | null
  /** Dónde está el visitador ahora. */
  visitador?: Coord | null
  /** Radio de precisión del GPS, en metros. Se dibuja como círculo. */
  precisionM?: number | null
  altura?: string
  /** Texto accesible del marcador del destino. */
  etiquetaDestino?: string
  /** Distancia calculada entre ambos, ya en metros. */
  distanciaM?: number | null
}

/**
 * Mapa de la visita: el pin del destino y, si se capturó, el del visitador.
 *
 * Cuando no hay coordenadas de destino NO se cae a una ubicación por defecto.
 * La app antes usaba una constante fija en Quito, lo cual significaba que si
 * el médico no tenía pin el mapa mostraba una calle de la capital con la
 * etiqueta del médico encima: parecía una ubicación y no lo era. Acá, sin
 * pin, el mapa queda vacío y se lo dice.
 */
export function UbicacionMapa({
  destino,
  visitador,
  precisionM,
  altura = '240px',
  etiquetaDestino = 'Destino',
  distanciaM,
}: UbicacionMapaProps) {
  const hayDestino = Boolean(destino)
  const hayVisitador = Boolean(visitador)

  // El centro se decide por lo que haya. Si solo hay destino, se centra en el
  // destino; si solo hay visitador, en el visitador. Nunca al revés: mostrar la
  // posición del visitador como si fuera el consultorio confunde.
  const centro: Coord = destino ?? visitador ?? [0, 0]
  const sinNada = !hayDestino && !hayVisitador

  return (
    <div className="ubicacion-mapa-wrap" style={{ height: altura }}>
      {sinNada ? (
        <div className="ubicacion-mapa-vacio">
          <span>Sin coordenadas</span>
          <small>
            No hay ubicación geocodificada para este destino, así que no se dibuja ningún mapa. Se
            registra igual.
          </small>
        </div>
      ) : (
        <MapContainer
          center={centro}
          zoom={hayDestino ? 16 : 15}
          scrollWheelZoom={false}
          className="ubicacion-mapa"
          zoomControl={false}
        >
          <TileLayer url={ENV.MAP_TILE_URL} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />

          {hayDestino && destino && (
            <Marker position={destino}>
              <Popup>{etiquetaDestino}</Popup>
            </Marker>
          )}

          {hayVisitador && visitador && (
            <>
              <Marker position={visitador} />
              {precisionM != null && precisionM > 0 && (
                <Circle
                  center={visitador}
                  radius={precisionM}
                  pathOptions={{ color: '#2563eb', fillOpacity: 0.12, weight: 1 }}
                />
              )}
            </>
          )}
        </MapContainer>
      )}

      {hayDestino && hayVisitador && distanciaM != null && (
        <div className="ubicacion-mapa-distancia">
          Distancia al destino: <strong>{formatear(distanciaM)}</strong>
        </div>
      )}
    </div>
  )
}

function formatear(metros: number): string {
  if (!Number.isFinite(metros)) return '—'
  if (metros < 1000) return `${Math.round(metros)} m`
  return `${(metros / 1000).toFixed(1)} km`
}
