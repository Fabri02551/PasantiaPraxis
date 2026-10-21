import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { COCHABAMBA_COORDS, COCHABAMBA_LABEL } from '../../../core/utils/mapDefaults'

function ClickHandler({ onChange }: { onChange: (c: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      onChange([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center as L.LatLngExpression)
  }, [map, center])
  return null
}

interface Props {
  /** null = sin ubicación guardada -> se MUESTRA Cochabamba pero NO se persiste */
  coords: [number, number] | null
  onChange: (c: [number, number]) => void
  height?: number
}

export const MapPicker: React.FC<Props> = ({ coords, onChange, height = 160 }) => {
  const display: [number, number] = coords ?? COCHABAMBA_COORDS
  const isPreview = coords === null

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e8ecf1' }}>
      <MapContainer
        key={`${display[0].toFixed(4)},${display[1].toFixed(4)}`}
        center={display}
        zoom={13}
        scrollWheelZoom={false}
        zoomControl
        style={{ height, width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
        <Recenter center={display} />
        <Marker
          position={display}
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
      <div style={{ padding: '6px 8px', background: '#f8f9fb', fontSize: 10.5, color: '#7e8aa6', display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span>
          {isPreview ? `Vista previa: ${COCHABAMBA_LABEL} (sin guardar)` : `Pin: ${display[0].toFixed(4)}, ${display[1].toFixed(4)}`}
        </span>
        <span style={{ color: '#2d9c9c', fontWeight: 600 }}>Click o arrastra el pin</span>
      </div>
    </div>
  )
}
