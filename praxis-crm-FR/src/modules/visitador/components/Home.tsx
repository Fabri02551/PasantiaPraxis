import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './Home.css'

// Fix default icon issue in Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

type Visit = {
  id: string
  dateLabel: string
  time: string
  company: string
  detail: string
  coords: [number, number]
}

const VISITS: Visit[] = []

const route: [number, number][] = []

function createColorIcon(color: string) {
  return L.divIcon({
    html: `<div style="background:${color}; width:22px; height:22px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3); display:grid; place-items:center;"><span style="transform:rotate(45deg); color:white; font-size:11px; font-weight:700;">•</span></div>`,
    className: 'custom-marker',
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  })
}

const markerColors = ['#F9B233', '#2D9C9C', '#E94E6B', '#4A7CF7', '#7B5CFF']

export const VisitadorHome: React.FC = () => {
  const center: [number, number] = [-0.1807, -78.4678]

  return (
    <div className="visitador-page">
      <header className="visitador-header">
        <button className="icon-btn" aria-label="Menú">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Ruta del Día</h1>
        <button className="icon-btn" aria-label="Notificaciones">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10 21a2 2 0 0 0 4 0" />
          </svg>
        </button>
      </header>

      <div className="visitador-content">
        <section className="map-card">
          <div className="map-badge">
            <span className="badge-dot" />
            3 Visitas Pendientes
          </div>
          <div className="map-wrapper">
            <MapContainer
              center={center}
              zoom={13}
              scrollWheelZoom={false}
              className="osm-map"
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Polyline positions={route} pathOptions={{ color: '#F9B233', weight: 4, opacity: 0.9 }} />
              {VISITS.slice(0, 4).map((v, idx) => (
                <Marker key={v.id} position={v.coords} icon={createColorIcon(markerColors[idx % markerColors.length])}>
                  <Popup>
                    <strong>{v.company}</strong>
                    <br />
                    {v.detail}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </section>

        <div className="action-row">
          <button className="btn-visit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Registrar Visita
          </button>
          <button className="btn-calendar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Calendario
          </button>
        </div>

        <section className="visits-card">
          <div className="visits-header">
            <h2>Próximas Visitas</h2>
            <a href="#" className="view-all">
              Ver todo
            </a>
          </div>

          <ul className="visits-list">
            {VISITS.map((v) => (
              <li key={v.id} className="visit-item">
                <div className="visit-date">
                  <span className="visit-date-label">{v.dateLabel}</span>
                  <span className="visit-time">{v.time}</span>
                </div>
                <div className="visit-info">
                  <span className="visit-company">{v.company}</span>
                  <span className="visit-detail">{v.detail}</span>
                </div>
                <span className="visit-chevron" aria-hidden>
                  ›
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
