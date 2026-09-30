import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function ClickHandler({ onChange }: { onChange: (c: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onChange([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

interface Props {
  /**
   * Puede venir null cuando la ubicación fue creada sin geocodificar. En ese
   * caso se muestra el mapa centrado en una vista general de Bolivia y sin
   * pin: es un editor, ver "todo Bolivia" es honesto, verlo sobre Quito no.
   */
  coords: [number, number] | null
  onChange: (c: [number, number]) => void
  height?: number
}

// Vista general del país. Es un viewport de edición, no una ubicación del
// médico: el pin recién aparece cuando la persona hace clic.
const VISTA_BOLIVIA: [number, number] = [-16.9, -64.6]

export const MapPicker: React.FC<Props> = ({ coords, onChange, height = 160 }) => {
  const conPin = coords !== null
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e8ecf1' }}>
      <MapContainer
        center={coords ?? VISTA_BOLIVIA}
        zoom={conPin ? 14 : 6}
        scrollWheelZoom={false}
        zoomControl={false}
        style={{ height, width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
        {conPin && coords && (
          <Marker
            position={coords}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const latlng = (e.target as L.Marker).getLatLng()
                onChange([latlng.lat, latlng.lng])
              },
            }}
          />
        )}
        <ClickHandler onChange={onChange} />
      </MapContainer>
      <div style={{ padding: '6px 8px', background: '#f8f9fb', fontSize: 10.5, color: '#7e8aa6', display: 'flex', justifyContent: 'space-between' }}>
        <span>{conPin ? `Pin: ${coords![0].toFixed(4)}, ${coords![1].toFixed(4)}` : 'Sin pin: haz clic para ubicar'}</span>
        <span style={{ color: '#2d9c9c', fontWeight: 600 }}>Click o arrastra el pin</span>
      </div>
    </div>
  )
}