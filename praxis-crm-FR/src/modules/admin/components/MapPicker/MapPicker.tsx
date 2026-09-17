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
  coords: [number, number]
  onChange: (c: [number, number]) => void
  height?: number
}

export const MapPicker: React.FC<Props> = ({ coords, onChange, height = 160 }) => {
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e8ecf1' }}>
      <MapContainer center={coords} zoom={14} scrollWheelZoom={false} zoomControl={false} style={{ height, width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
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
        <ClickHandler onChange={onChange} />
      </MapContainer>
      <div style={{ padding: '6px 8px', background: '#f8f9fb', fontSize: 10.5, color: '#7e8aa6', display: 'flex', justifyContent: 'space-between' }}>
        <span>Pin: {coords[0].toFixed(4)}, {coords[1].toFixed(4)}</span>
        <span style={{ color: '#2d9c9c', fontWeight: 600 }}>Click o arrastra el pin</span>
      </div>
    </div>
  )
}
