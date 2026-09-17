import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { VisitDetailExpanded, type ExpandedVisit } from '../../components/VisitDetailExpanded'
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
  addr: string
  contact: string
  phone: string
  status: string
  description: string
  medico: { nombre: string; especialidad: string; hospital: string; phone: string }
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

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface HomeProps {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
  onCompletar?: (visita: { id: string; company: string; detail: string; addr: string; time: string; dateLabel?: string; medico: { nombre: string; especialidad: string; hospital: string; phone: string }; contact?: string; phone?: string; status?: string }) => void
}

function toExpanded(v: Visit): ExpandedVisit {
  return {
    id: v.id,
    time: v.time,
    dateLabel: v.dateLabel,
    company: v.company,
    detail: v.detail,
    addr: v.addr,
    contact: v.contact,
    phone: v.phone,
    status: v.status,
    description: v.description,
    coords: v.coords,
    medico: v.medico,
  }
}

export const VisitadorHome: React.FC<HomeProps> = ({ onNavigate, currentView, onLogout, onCompletar }) => {
  const center: [number, number] = [-0.1807, -78.4678]
  const [menuOpen, setMenuOpen] = useState(false)
  const [detail, setDetail] = useState<Visit | null>(null)
  const [expanded, setExpanded] = useState<ExpandedVisit | null>(null)

  return (
    <div className="visitador-page">
      <header className="visitador-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Ruta del Día</h1>
        <button className="icon-btn notification-btn" aria-label="Notificaciones" onClick={() => onNavigate('notificaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <span className="notification-dot" />
        </button>
      </header>
      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate} currentView={currentView} onLogout={onLogout} />

      <div className="visitador-content">
        <section className="map-card">
          <div className="map-badge">
            <span className="badge-dot" />
            {VISITS.length} Visitas Pendientes
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
              {route.length > 0 && <Polyline positions={route} pathOptions={{ color: '#F9B233', weight: 4, opacity: 0.9 }} />}
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
          <button className="btn-visit" onClick={() => onNavigate('registro')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Visita Extraordinaria
          </button>
          <button className="btn-calendar" onClick={() => onNavigate('calendario')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Calendario
          </button>
        </div>

        <section className="visits-card">
          <div className="visits-header">
            <h2>Visitas programadas</h2>
            <span style={{ fontSize: 11, color: '#7e8aa6', fontWeight: 600 }}>{VISITS.filter(v=>v.dateLabel==='Hoy').length} hoy</span>
          </div>

          {VISITS.length === 0 ? (
            <p style={{ fontSize: 12, color: '#7e8aa6', padding: '12px 0', textAlign: 'center' }}>No hay visitas programadas - sin datos en la base de datos</p>
          ) : (
            <ul className="visits-list">
              {VISITS.filter(v=>v.dateLabel==='Hoy').map((v) => (
                <li key={v.id} className="visit-item" onClick={() => setDetail(v)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setDetail(v)} style={{ cursor: 'pointer' }}>
                  <div className="visit-date">
                    <span className="visit-date-label">{v.dateLabel}</span>
                    <span className="visit-time">{v.time}</span>
                  </div>
                  <div className="visit-info">
                    <span className="visit-company">{v.company}</span>
                    <span className="visit-detail">{v.detail}</span>
                  </div>
                  <span className={`visit-status-badge status-${v.status.toLowerCase().replace(' ', '-')}`}>{v.status}</span>
                </li>
              ))}
            </ul>
          )}
          <button className="view-all" onClick={() => onNavigate('calendario')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 8, fontSize: 12, color: '#2d9c9c', fontWeight: 600, textAlign: 'left', padding: 0 }}>
            ver más visitas en el calendario →
          </button>
        </section>
      </div>

      {detail && (
        <div className="visit-detail-overlay" onClick={() => setDetail(null)}>
          <div className="visit-detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Detalle de ${detail.company}`}>
            <div className="visit-detail-header">
              <span className="visit-detail-badge">{detail.time} · {detail.dateLabel}</span>
              <span className={`visit-detail-status status-${detail.status.toLowerCase().replace(' ', '-')}`}>{detail.status}</span>
              <button
                className="visit-detail-expand"
                onClick={() => {
                  setExpanded(toExpanded(detail))
                }}
                aria-label="Ver detalle completo"
                title="Ver detalle completo con mapa y médico"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h6v6" />
                  <path d="M9 21H3v-6" />
                  <path d="M21 3l-7 7" />
                  <path d="M3 21l7-7" />
                </svg>
              </button>
              <button className="visit-detail-close" onClick={() => setDetail(null)} aria-label="Cerrar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <h3 className="visit-detail-title">{detail.company}</h3>
            <p className="visit-detail-addr">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7a99" strokeWidth="1.8">
                <path d="M12 21s-6-4.5-6-10a6 6 0 0 1 12 0c0 5.5-6 10-6 10z" />
                <circle cx="12" cy="11" r="2" />
              </svg>
              {detail.addr}
            </p>
            <p className="visit-detail-subtitle">{detail.detail}</p>
            <div className="visit-detail-grid">
              <div className="visit-detail-field">
                <span className="visit-detail-label">CONTACTO</span>
                <span className="visit-detail-value">{detail.contact}</span>
              </div>
              <div className="visit-detail-field">
                <span className="visit-detail-label">TELÉFONO</span>
                <span className="visit-detail-value">{detail.phone}</span>
              </div>
            </div>
            <div className="visit-detail-field">
              <span className="visit-detail-label">DESCRIPCIÓN</span>
              <p className="visit-detail-desc">{detail.description}</p>
            </div>
            <div style={{ marginTop: 12, background: '#f8f9fb', border: '1px solid #eef1f5', borderRadius: 10, padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#1B2A4E,#2d9c9c)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {detail.medico.nombre.split(' ').filter(w=>w.length>2).slice(0,2).map(w=>w[0]).join('').slice(0,2)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1B2A4E' }}>{detail.medico.nombre}</div>
                <div style={{ fontSize: 11, color: '#2d9c9c' }}>{detail.medico.especialidad}</div>
                <div style={{ fontSize: 11, color: '#6b7a99' }}>{detail.medico.hospital} · {detail.medico.phone}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="visit-detail-primary" style={{ flex: 1 }} onClick={() => setExpanded(toExpanded(detail))}>
                Ver Detalle Completo
              </button>
              <button
                className="visit-detail-primary"
                style={{ flex: 1, background: '#F9B233', color: '#fff', border: 'none' }}
                onClick={() => {
                  const visita = detail
                  setDetail(null)
                  if (visita && onCompletar) {
                    onCompletar({
                      id: visita.id,
                      company: visita.company,
                      detail: visita.detail,
                      addr: visita.addr,
                      time: visita.time,
                      dateLabel: visita.dateLabel,
                      medico: visita.medico,
                      contact: visita.contact,
                      phone: visita.phone,
                      status: visita.status,
                    })
                  } else {
                    onNavigate('registro')
                  }
                }}
              >
                Completar visita
              </button>
            </div>
          </div>
        </div>
      )}
      {expanded && <VisitDetailExpanded visit={expanded} onClose={() => setExpanded(null)} />}
    </div>
  )
}
