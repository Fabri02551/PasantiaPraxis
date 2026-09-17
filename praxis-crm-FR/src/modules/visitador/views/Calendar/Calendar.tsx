import { useState } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { VisitDetailExpanded, type ExpandedVisit } from '../../components/VisitDetailExpanded'
import './Calendar.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
  onCompletar?: (visita: { id: string; company: string; detail: string; addr: string; time: string; dateLabel?: string; medico: { nombre: string; especialidad: string; hospital: string; phone: string }; contact?: string; phone?: string; status?: string }) => void
}

const HIGHLIGHTED_ORANGE = new Set<number>([])
const HIGHLIGHTED_BLUE = new Set<number>([])

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

const VISITS_BY_DATE: Record<number, VisitDetail[]> = {}

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

export const CalendarView: React.FC<Props> = ({ onNavigate, currentView, onLogout, onCompletar }) => {
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
  const allVisits = Object.entries(VISITS_BY_DATE).flatMap(([day, list]) => list.map(v => ({ ...v, day: Number(day) })))

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
                <li key={v.title} className="visit-row" onClick={() => setDetail(v)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setDetail(v)} style={{ cursor: 'pointer' }}>
                  <span className="visit-time-badge">{v.time}</span>
                  <div className="visit-text">
                    <span className="visit-title">{v.title}</span>
                    <span className="visit-addr">{v.addr}</span>
                  </div>
                  <span className={`visit-detail-status status-${v.status.toLowerCase().replace(' ', '-')}`} style={{ fontSize: 10, padding: '3px 7px' }}>{v.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="visits-today" style={{ marginTop: 12 }}>
          <h2 className="visits-today-title">Todas las visitas programadas</h2>
          <p style={{ fontSize: 11, color: '#7e8aa6', margin: '4px 0 8px' }}>{allVisits.length} visitas en total</p>
          <ul className="visits-today-list">
            {allVisits.map((v) => (
              <li key={`${v.day}-${v.title}`} className="visit-row" onClick={() => setDetail(v)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setDetail(v)} style={{ cursor: 'pointer' }}>
                <span className="visit-time-badge">{v.time} · {v.day} Oct</span>
                <div className="visit-text">
                  <span className="visit-title">{v.title}</span>
                  <span className="visit-addr">{v.addr}</span>
                </div>
                <span className={`visit-detail-status status-${v.status.toLowerCase().replace(' ', '-')}`} style={{ fontSize: 10, padding: '3px 7px' }}>{v.status}</span>
              </li>
            ))}
          </ul>
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
              <button className="visit-detail-primary" style={{ flex: 1 }} onClick={() => setExpanded(toExpandedCalendar(detail))}>
                Ver Detalle Completo
              </button>
              <button
                className="visit-detail-primary"
                style={{ flex: 1, background: '#F9B233', color: '#fff', border: 'none' }}
                onClick={() => {
                  const v = detail
                  setDetail(null)
                  if (v && onCompletar) {
                    onCompletar({
                      id: `${v.title}-${v.time}`,
                      company: v.title,
                      detail: v.title,
                      addr: v.addr,
                      time: v.time,
                      medico: v.medico,
                      contact: v.contact,
                      phone: v.phone,
                      status: v.status,
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

export const VisitadorCalendar = CalendarView
