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

const VISITS: Visit[] = [
  {
    id: '1',
    dateLabel: 'Hoy',
    time: '10:00',
    company: 'TecnoCorp S.A.',
    detail: 'Mantenimiento Preventivo Servidores',
    coords: [-0.1807, -78.478],
    addr: 'Torre Central, Piso 8 - Av. Amazonas',
    contact: 'Carlos Ruiz',
    phone: '+507 6123-9988',
    status: 'Programada',
    description: 'Mantenimiento preventivo de servidores. Coordinar acceso con seguridad y llevar checklist de verificación.',
    medico: { nombre: 'Dr. Roberto García', especialidad: 'Cardiólogo', hospital: 'Hospital Ángeles Metropolitana', phone: '+507 6123-4455' },
  },
  {
    id: '2',
    dateLabel: 'Hoy',
    time: '14:30',
    company: 'Constructora Andes',
    detail: 'Inspección de Obra y Firma de Avance',
    coords: [-0.184, -78.465],
    addr: 'Obra Vía Interoceánica, Galpón B',
    contact: 'Ing. Valeria Mora',
    phone: '+507 6345-1120',
    status: 'Confirmada',
    description: 'Inspección de avance de obra y firma de acta. Requiere casco y credencial.',
    medico: { nombre: 'Dra. María López', especialidad: 'Pediatra', hospital: 'Clínica Infantil San José', phone: '+507 6345-7788' },
  },
  {
    id: '3',
    dateLabel: 'Mañ',
    time: '09:00',
    company: 'Logística Central',
    detail: 'Reunión de Renovación de Contrato',
    coords: [-0.195, -78.486],
    addr: 'Km 7 Vía Tocumen, Oficina 201',
    contact: 'Lic. Jorge Pineda',
    phone: '+507 6770-3344',
    status: 'Programada',
    description: 'Reunión para renovación de contrato anual. Llevar propuesta comercial actualizada.',
    medico: { nombre: 'Dr. Carlos Mendoza', especialidad: 'Traumatólogo', hospital: 'Centro Médico ABC', phone: '+507 6770-9900' },
  },
  {
    id: '4',
    dateLabel: '24 Oct',
    time: '11:00',
    company: 'Retail Plaza',
    detail: 'Instalación de Terminales POS',
    coords: [-0.172, -78.472],
    addr: 'Local 105, Vía España',
    contact: 'Ana Jiménez',
    phone: '+507 6550-1100',
    status: 'En curso',
    description: 'Instalación y prueba de 3 terminales POS. Capacitar a cajeros y dejar manual.',
    medico: { nombre: 'Dra. Ana Sofía Ruiz', especialidad: 'Ginecóloga', hospital: 'Hospital Delta Especialidades', phone: '+507 6550-3366' },
  },
  {
    id: '5',
    dateLabel: '25 Oct',
    time: '16:00',
    company: 'Clínica San José',
    detail: 'Demo técnica de Software Médico',
    coords: [-0.189, -78.455],
    addr: 'Auditorio Principal - Clínica San José',
    contact: 'Dra. Sofía Hernández',
    phone: '+507 6777-2233',
    status: 'Programada',
    description: 'Demo de software médico Praxis v2.4. Llevar proyector y muestras impresas.',
    medico: { nombre: 'Dra. Sofía Hernández', especialidad: 'Medicina General', hospital: 'Clínica San José', phone: '+507 6777-2233' },
  },
]

const route: [number, number][] = VISITS.slice(0, 4).map((v) => v.coords)

function createColorIcon(color: string) {
  return L.divIcon({
    html: `<div style="background:${color}; width:22px; height:22px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3); display:grid; place-items:center;"><span style="transform:rotate(45deg); color:white; font-size:11px; font-weight:700;">•</span></div>`,
    className: 'custom-marker',
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  })
}

const markerColors = ['#F9B233', '#2D9C9C', '#E94E6B', '#4A7CF7', '#7B5CFF']

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos'

interface HomeProps {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
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

export const VisitadorHome: React.FC<HomeProps> = ({ onNavigate, currentView, onLogout }) => {
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
          <button className="btn-visit" onClick={() => onNavigate('registro')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Registrar Visita
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
            <h2>Próximas Visitas</h2>
            <button className="view-all" onClick={() => onNavigate('calendario')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              Ver todo
            </button>
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
                <button className="visit-chevron" aria-label={`Ver detalle de ${v.company}`} onClick={() => setDetail(v)}>
                  ›
                </button>
              </li>
            ))}
          </ul>
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
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="visit-detail-primary" style={{ flex: 1 }} onClick={() => setExpanded(toExpanded(detail))}>
                Ver Detalle Completo
              </button>
              <button className="visit-detail-primary" style={{ flex: 1, background: '#fff', color: '#1b2a4e', border: '1px solid #e8ecf1' }} onClick={() => setDetail(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {expanded && <VisitDetailExpanded visit={expanded} onClose={() => setExpanded(null)} />}
    </div>
  )
}
