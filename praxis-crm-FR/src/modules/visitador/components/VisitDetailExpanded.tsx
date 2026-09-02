import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './VisitDetailExpanded.css'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix default icon for Vite
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

export type MedicoInfo = {
  nombre: string
  especialidad: string
  hospital: string
  phone: string
  avatar?: string
}

export type ExpandedVisit = {
  id?: string
  time: string
  dateLabel?: string
  company: string
  detail: string
  addr: string
  contact: string
  phone: string
  status: string
  description: string
  coords: [number, number]
  medico: MedicoInfo
}

interface Props {
  visit: ExpandedVisit
  onClose: () => void
}

function getInitials(nombre: string) {
  return nombre
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
    .slice(0, 2)
}

export const VisitDetailExpanded: React.FC<Props> = ({ visit, onClose }) => {
  // lock scroll behind
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div className="visit-expanded-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Detalle completo de ${visit.company}`}>
      <div className="visit-expanded-modal" onClick={(e) => e.stopPropagation()}>
        <div className="visit-expanded-header">
          <button className="visit-expanded-back" onClick={onClose} aria-label="Cerrar detalle completo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h2 className="visit-expanded-title">Detalle de Visita</h2>
          <button className="visit-detail-close" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="visit-expanded-body">
          {/* Estado y hora */}
          <div className="visit-detail-header" style={{ marginBottom: 10 }}>
            <span className="visit-detail-badge">
              {visit.time} {visit.dateLabel ? `· ${visit.dateLabel}` : ''}
            </span>
            <span className={`visit-detail-status status-${visit.status.toLowerCase().replace(' ', '-')}`}>{visit.status}</span>
          </div>

          <h3 className="visit-detail-title" style={{ fontSize: 16 }}>{visit.company}</h3>
          <p className="visit-detail-subtitle">{visit.detail}</p>

          <p className="visit-detail-addr">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7a99" strokeWidth="1.8">
              <path d="M12 21s-6-4.5-6-10a6 6 0 0 1 12 0c0 5.5-6 10-6 10z" />
              <circle cx="12" cy="11" r="2" />
            </svg>
            {visit.addr}
          </p>

          <div className="visit-detail-grid">
            <div className="visit-detail-field">
              <span className="visit-detail-label">CONTACTO</span>
              <span className="visit-detail-value">{visit.contact}</span>
            </div>
            <div className="visit-detail-field">
              <span className="visit-detail-label">TELÉFONO</span>
              <span className="visit-detail-value">{visit.phone}</span>
            </div>
          </div>

          <div className="visit-detail-field" style={{ marginBottom: 16 }}>
            <span className="visit-detail-label">DESCRIPCIÓN</span>
            <p className="visit-detail-desc">{visit.description}</p>
          </div>

          <div className="visit-expanded-divider" />

          {/* Información del Médico */}
          <section className="visit-expanded-medico">
            <h4 className="visit-expanded-section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1b2a4e" strokeWidth="1.8">
                <circle cx="12" cy="8" r="4" />
                <path d="M5 20a7 7 0 0 1 14 0" />
              </svg>
              Información del Médico
            </h4>
            <div className="medico-card-expanded">
              <div className="medico-avatar">
                {getInitials(visit.medico.nombre)}
              </div>
              <div className="medico-expanded-info">
                <span className="medico-expanded-name">{visit.medico.nombre}</span>
                <span className="medico-expanded-specialty">{visit.medico.especialidad}</span>
                <span className="medico-expanded-hospital">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7a99" strokeWidth="1.8">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <path d="M9 22V12h6v10" />
                  </svg>
                  {visit.medico.hospital}
                </span>
                <span className="medico-expanded-phone">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7a99" strokeWidth="1.8">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12 1.48.45 2.94.95 4.24a2 2 0 0 1-.57 2.11L8.09 12a16 16 0 0 0 4 4l1.93-1.4a2 2 0 0 1 2.11-.57c1.3.5 2.76.83 4.24.95A2 2 0 0 1 22 16.92z" />
                  </svg>
                  {visit.medico.phone}
                </span>
              </div>
            </div>
          </section>

          {/* Mapa */}
          <section className="visit-expanded-map-section">
            <h4 className="visit-expanded-section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1b2a4e" strokeWidth="1.8">
                <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" />
                <path d="M8 2v16M16 6v16" />
              </svg>
              Ubicación del Médico
            </h4>
            <p className="visit-expanded-map-addr">{visit.addr}</p>
            <div className="visit-expanded-map-wrapper">
              <MapContainer center={visit.coords} zoom={15} scrollWheelZoom={false} className="visit-expanded-map" zoomControl={false}>
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={visit.coords} />
              </MapContainer>
            </div>
            <a
              className="visit-expanded-map-link"
              href={`https://www.openstreetmap.org/?mlat=${visit.coords[0]}&mlon=${visit.coords[1]}#map=16/${visit.coords[0]}/${visit.coords[1]}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir en OpenStreetMap
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <path d="M15 3h6v6" />
                <path d="M10 14L21 3" />
              </svg>
            </a>
          </section>
        </div>

        <div className="visit-expanded-footer">
          <button className="visit-detail-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
