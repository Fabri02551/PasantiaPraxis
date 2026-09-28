import { useState } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { VisitDetailExpanded, type ExpandedVisit } from '../../components/VisitDetailExpanded'
import './Calendar.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

// Octubre 2026 data based on image: highlights 2, 8, 12, 18
const HIGHLIGHTED_ORANGE = new Set([2, 12, 18])
const HIGHLIGHTED_BLUE = new Set([8])

type VisitDetail = {
  time: string
  title: string
  addr: string
  contact: string
  phone: string
  description: string
  status: string
  coords: [number, number]
  medico: { nombre: string; especialidad: string; hospital: string; phone: string }
}

const VISITS_BY_DATE: Record<number, VisitDetail[]> = {
  12: [
    {
      time: '09:30 AM',
      title: 'Distribuidora del Norte',
      addr: 'Km 14 Vía Transístmica, Galpón C',
      contact: 'Ing. Roberto Vega',
      phone: '+507 6670-1234',
      description: 'Entrega de muestras y revisión de inventario. Llevar catálogo actualizado y contrato marco.',
      status: 'Programada',
      coords: [-0.1807, -78.478],
      medico: { nombre: 'Dr. Roberto García', especialidad: 'Cardiólogo', hospital: 'Hospital Ángeles Metropolitana', phone: '+507 6123-4455' },
    },
    {
      time: '02:00 PM',
      title: 'Consultores Financieros',
      addr: 'Av. Balboa, Edificio Mirage, Piso 12',
      contact: 'Lic. Mariana Torres',
      phone: '+507 6988-4421',
      description: 'Presentación de propuesta anual y firma de adenda. Confirmar sala 30 min antes.',
      status: 'Confirmada',
      coords: [-0.184, -78.465],
      medico: { nombre: 'Dra. María López', especialidad: 'Pediatra', hospital: 'Clínica Infantil San José', phone: '+507 6345-7788' },
    },
  ],
  2: [
    {
      time: '10:00 AM',
      title: 'TecnoCorp S.A.',
      addr: 'Mantenimiento Preventivo - Torre Central, Piso 8',
      contact: 'Carlos Ruiz',
      phone: '+507 6123-9988',
      description: 'Mantenimiento preventivo de servidores. Coordinar acceso con seguridad.',
      status: 'Programada',
      coords: [-0.189, -78.47],
      medico: { nombre: 'Dr. Javier Hernández', especialidad: 'Dermatólogo', hospital: 'Clínica Médica Santa Fe', phone: '+507 6770-9900' },
    },
  ],
  8: [
    {
      time: '11:00 AM',
      title: 'Retail Plaza',
      addr: 'Instalación POS - Local 105, Vía España',
      contact: 'Ana Jiménez',
      phone: '+507 6550-1100',
      description: 'Instalación y prueba de 3 terminales POS. Capacitar a cajeros.',
      status: 'En curso',
      coords: [-0.172, -78.472],
      medico: { nombre: 'Dra. Ana Sofía Ruiz', especialidad: 'Ginecóloga', hospital: 'Hospital Delta Especialidades', phone: '+507 6550-3366' },
    },
  ],
  18: [
    {
      time: '03:00 PM',
      title: 'Clínica San José',
      addr: 'Demo técnica - Auditorio Principal',
      contact: 'Dra. Sofía Hernández',
      phone: '+507 6777-2233',
      description: 'Demo de software médico Praxis v2.4. Llevar proyector y muestras impresas.',
      status: 'Programada',
      coords: [-0.189, -78.455],
      medico: { nombre: 'Dra. Sofía Hernández', especialidad: 'Medicina General', hospital: 'Clínica San José', phone: '+507 6777-2233' },
    },
  ],
}

function toExpandedCalendar(v: VisitDetail): ExpandedVisit {
  return {
    time: v.time,
    company: v.title,
    detail: v.title,
    addr: v.addr,
    contact: v.contact,
    phone: v.phone,
    status: v.status,
    description: v.description,
    coords: v.coords,
    medico: v.medico,
  }
}

function getOctober2026Days() {
  const blanks = [
    { d: 28, muted: true },
    { d: 29, muted: true },
    { d: 30, muted: true },
  ]
  return { blanks, daysInMonth: 31, startWeekday: 4 }
}

export const CalendarView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [selected, setSelected] = useState(12)
  const [detail, setDetail] = useState<VisitDetail | null>(null)
  const [expanded, setExpanded] = useState<ExpandedVisit | null>(null)

  const { blanks } = getOctober2026Days()

  const renderCell = (day: number, muted = false) => {
    const isOrange = HIGHLIGHTED_ORANGE.has(day) && !muted
    const isBlue = HIGHLIGHTED_BLUE.has(day) && !muted
    const isSelected = selected === day
    return (
      <button
        key={`${muted ? 'm' : ''}${day}`}
        className={`cal-cell ${muted ? 'muted' : ''} ${isOrange ? 'orange' : ''} ${isBlue ? 'blue' : ''} ${isSelected ? 'selected' : ''}`}
        onClick={() => !muted && setSelected(day)}
      >
        {day}
      </button>
    )
  }

  const visits = VISITS_BY_DATE[selected] || []

  return (
    <div className="calendar-page">
      <header className="calendar-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Calendario</h1>
        <button className="icon-btn notification-btn" aria-label="Notificaciones" onClick={() => onNavigate('notificaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <span className="notification-dot" />
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate} currentView={currentView} onLogout={onLogout} />

      <div className="calendar-content">
        <div className="calendar-card">
          <div className="calendar-head">
            <button className="cal-nav" aria-label="Mes anterior">‹</button>
            <span className="cal-month">Octubre 2026</span>
            <button className="cal-nav" aria-label="Mes siguiente">›</button>
          </div>

          <div className="cal-weekdays">
            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d) => (
              <span key={d} className="cal-wd">
                {d}
              </span>
            ))}
          </div>

          <div className="cal-grid">
            {blanks.map((b) => renderCell(b.d, true))}
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => renderCell(d))}
            {renderCell(1, true)}
          </div>
        </div>

        <section className="visits-today">
          <h2 className="visits-today-title">Visitas de Hoy ({selected} de Octubre)</h2>
          {visits.length === 0 ? (
            <p className="no-visits">No hay visitas para este día</p>
          ) : (
            <ul className="visits-today-list">
              {visits.map((v) => (
                <li key={v.title} className="visit-row">
                  <span className="visit-time-badge">{v.time}</span>
                  <div className="visit-text">
                    <span className="visit-title">{v.title}</span>
                    <span className="visit-addr">{v.addr}</span>
                  </div>
                  <button className="visit-arrow" aria-label={`Ver detalle de ${v.title}`} onClick={() => setDetail(v)}>
                    →
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {detail && (
        <div className="visit-detail-overlay" onClick={() => setDetail(null)}>
          <div className="visit-detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Detalle de ${detail.title}`}>
            <div className="visit-detail-header">
              <span className="visit-detail-badge">{detail.time}</span>
              <span className={`visit-detail-status status-${detail.status.toLowerCase().replace(' ', '-')}`}>{detail.status}</span>
              <button
                className="visit-detail-expand"
                onClick={() => setExpanded(toExpandedCalendar(detail))}
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
            <h3 className="visit-detail-title">{detail.title}</h3>
            <p className="visit-detail-addr">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7a99" strokeWidth="1.8">
                <path d="M12 21s-6-4.5-6-10a6 6 0 0 1 12 0c0 5.5-6 10-6 10z" />
                <circle cx="12" cy="11" r="2" />
              </svg>
              {detail.addr}
            </p>
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
              <button className="visit-detail-primary" style={{ flex: 1 }} onClick={() => setExpanded(toExpandedCalendar(detail))}>
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

export const VisitadorCalendar = CalendarView
