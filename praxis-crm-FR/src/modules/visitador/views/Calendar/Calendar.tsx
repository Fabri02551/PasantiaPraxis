import { useMemo, useState } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { useMisVisitas, visitaToACompletar, type VisitaResuelta } from '../../hooks/useMisVisitas'
import type { VisitaACompletar } from '../CompletarVisita/CompletarVisita'
import './Calendar.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
  onCompletar?: (visita: VisitaACompletar) => void
}

const WEEKDAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const pad = (n: number) => String(n).padStart(2, '0')

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const startWeekday = (first.getDay() + 6) % 7 // lunes = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return { startWeekday, daysInMonth }
}

function estadoInfo(v: VisitaResuelta) {
  const realizada = v.registrada || v.estado === 'realizada'
  return {
    label: realizada ? 'Realizada' : 'Por visitar',
    bg: realizada ? '#e6f7ed' : '#fef6e7',
    color: realizada ? '#0e502e' : '#92400e',
    border: realizada ? '#a7f3d0' : '#fde68a',
  }
}

function fechaLegible(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return `${d} de ${MONTHS[(m || 1) - 1]} ${y}`
}

export const CalendarView: React.FC<Props> = ({ onNavigate, currentView, onLogout, onCompletar }) => {
  const { visitas, loading } = useMisVisitas()
  const hoy = new Date()
  const [menuOpen, setMenuOpen] = useState(false)
  const [cursor, setCursor] = useState({ year: hoy.getFullYear(), month: hoy.getMonth() })
  const [selected, setSelected] = useState(hoy.getDate())
  const [detalle, setDetalle] = useState<VisitaResuelta | null>(null)

  const { startWeekday, daysInMonth } = monthGrid(cursor.year, cursor.month)
  const monthKey = `${cursor.year}-${pad(cursor.month + 1)}`

  const porMes = useMemo(() => visitas.filter((v) => v.fecha && v.fecha.startsWith(monthKey)), [visitas, monthKey])
  const visitasPorDia = useMemo(() => {
    const m = new Map<number, VisitaResuelta[]>()
    porMes.forEach((v) => {
      const d = Number(v.fecha!.slice(8, 10))
      m.set(d, [...(m.get(d) || []), v])
    })
    return m
  }, [porMes])

  const close = (n: number) => {
    const y = cursor.year
    const m = cursor.month + n
    const ny = new Date(y, m, 1)
    setCursor({ year: ny.getFullYear(), month: ny.getMonth() })
    setSelected(1)
  }

  const renderCell = (day: number, muted = false) => {
    const dia = visitasPorDia.get(day) || []
    const isSelected = selected === day
    const hasRealizada = dia.some((v) => estadoInfo(v).label === 'Realizada')
    const hasPendiente = dia.some((v) => estadoInfo(v).label === 'Por visitar')
    return (
      <button
        key={`${muted ? 'm' : ''}${day}`}
        className={`cal-cell ${muted ? 'muted' : ''} ${isSelected ? 'selected' : ''} ${hasPendiente ? 'orange' : ''} ${hasRealizada ? 'blue' : ''}`}
        onClick={() => !muted && setSelected(day)}
        style={{ display: 'flex', flexDirection: 'column', gap: 1 }}
      >
        <span>{muted ? '' : day}</span>
        {!muted && dia.length > 0 && (
          <span style={{ fontSize: 8, lineHeight: 1, opacity: 0.85, fontWeight: 700 }}>{dia.length}</span>
        )}
      </button>
    )
  }

  const blanks = Array.from({ length: startWeekday }, (_, i) => i + 1)
  const hoyEsMes = hoy.getFullYear() === cursor.year && hoy.getMonth() === cursor.month
  const visitasHoy = visitasPorDia.get(selected) || []

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
        {loading && <p style={{ fontSize: 12, color: '#7e8aa6', textAlign: 'center', margin: '16px 0' }}>Cargando visitas…</p>}

        <div className="calendar-card">
          <div className="calendar-head">
            <button className="cal-nav" aria-label="Mes anterior" onClick={() => close(-1)}>‹</button>
            <span className="cal-month">{MONTHS[cursor.month]} {cursor.year}</span>
            <button className="cal-nav" aria-label="Mes siguiente" onClick={() => close(1)}>›</button>
          </div>

          <div className="cal-weekdays">
            {WEEKDAYS.map((d) => (
              <span key={d} className="cal-wd">
                {d}
              </span>
            ))}
          </div>

          <div className="cal-grid">
            {blanks.map((i) => renderCell(i, true))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => renderCell(d))}
          </div>
        </div>

        <section className="visits-today">
          <h2 className="visits-today-title">
            {hoyEsMes && selected === hoy.getDate() ? `Visitas de Hoy (${selected} de ${MONTHS[cursor.month]})` : `Visitas del ${selected} de ${MONTHS[cursor.month]}`}
          </h2>
          {visitasHoy.length === 0 ? (
            <p className="no-visits">No hay visitas para este día</p>
          ) : (
            <ul className="visits-today-list">
              {visitasHoy.map((v) => {
                const est = estadoInfo(v)
                return (
                  <li key={v.id} className="visit-row" onClick={() => setDetalle(v)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setDetalle(v)} style={{ cursor: 'pointer' }}>
                    <span className="visit-time-badge">{v.hora}</span>
                    <div className="visit-text">
                      <span className="visit-title">{v.destino.nombre}</span>
                      <span className="visit-addr">{v.destino.direccion}</span>
                    </div>
                    <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 8, background: est.bg, color: est.color, border: `1px solid ${est.border}`, whiteSpace: 'nowrap' }}>{est.label}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="visits-today" style={{ marginTop: 12 }}>
          <h2 className="visits-today-title">Todas las visitas programadas</h2>
          <p style={{ fontSize: 11, color: '#7e8aa6', margin: '4px 0 8px' }}>{porMes.length} visitas en {MONTHS[cursor.month].toLowerCase()} {cursor.year}</p>
          <ul className="visits-today-list">
            {porMes.map((v) => {
              const est = estadoInfo(v)
              return (
                <li key={v.id} className="visit-row" onClick={() => setDetalle(v)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setDetalle(v)} style={{ cursor: 'pointer' }}>
                  <span className="visit-time-badge">{v.fecha ? `D${v.fecha.slice(8, 10)}` : '—'} · {v.hora}</span>
                  <div className="visit-text">
                    <span className="visit-title">{v.destino.nombre}</span>
                    <span className="visit-addr">{v.destino.subtitulo || 'Médico/Institución'} · {v.destino.direccion}</span>
                  </div>
                  <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 8, background: est.bg, color: est.color, border: `1px solid ${est.border}`, whiteSpace: 'nowrap' }}>{est.label}</span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      {detalle && (
        <div className="visit-detail-overlay" onClick={() => setDetalle(null)}>
          <div className="visit-detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Detalle de ${detalle.destino.nombre}`}>
            <div className="visit-detail-header">
              <span className="visit-detail-badge">{detalle.fecha ? fechaLegible(detalle.fecha) : 'Sin fecha'} · {detalle.hora}</span>
              <span className="visit-detail-status" style={{ background: estadoInfo(detalle).bg, color: estadoInfo(detalle).color }}>{estadoInfo(detalle).label}</span>
              <button className="visit-detail-close" onClick={() => setDetalle(null)} aria-label="Cerrar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <h3 className="visit-detail-title">{detalle.destino.nombre}</h3>
            <p className="visit-detail-subtitle">{detalle.destino.subtitulo || (detalle.tipo === 'institucion' ? 'Institución de salud' : 'Médico')}</p>
            <p className="visit-detail-addr">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7a99" strokeWidth="1.8">
                <path d="M12 21s-6-4.5-6-10a6 6 0 0 1 12 0c0 5.5-6 10-6 10z" />
                <circle cx="12" cy="11" r="2" />
              </svg>
              {detalle.destino.direccion}
            </p>
            <div className="visit-detail-grid">
              <div className="visit-detail-field">
                <span className="visit-detail-label">TIPO</span>
                <span className="visit-detail-value">{detalle.tipo === 'institucion' ? 'Institución' : 'Médico'}</span>
              </div>
              {detalle.destino.particular ? (
                <div className="visit-detail-field">
                  <span className="visit-detail-label">MODALIDAD</span>
                  <span className="visit-detail-value">Particular</span>
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                className="visit-detail-primary"
                style={{ flex: 1, background: '#F9B233', color: '#fff', border: 'none' }}
                onClick={() => {
                  const v = detalle
                  setDetalle(null)
                  if (onCompletar) {
                    onCompletar(visitaToACompletar(v))
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
    </div>
  )
}

export const VisitadorCalendar = CalendarView