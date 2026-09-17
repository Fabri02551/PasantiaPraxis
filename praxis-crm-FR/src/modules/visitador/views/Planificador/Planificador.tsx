import { useState, useMemo, useEffect } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { medicoService } from '../../../core/services/medico.service'
import './Planificador.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

type Ubicacion = { id: string; direccion: string; detalle: string; coords: [number, number] }
type MedicoPlan = { id: string; nombre: string; especialidad: string; ubicaciones: Ubicacion[] }

const MEDICOS: MedicoPlan[] = []

type VisitaTentativa = {
  id: string
  fecha: Date | null
  hora: string // e.g. "10:30"
  period: 'AM' | 'PM'
  showDate: boolean
  showTime: boolean
}

export const PlanificadorView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [medicos, setMedicos] = useState<MedicoPlan[]>(MEDICOS)
  const [selectedMedico, setSelectedMedico] = useState<string>('')
  const [selectedUbicacion, setSelectedUbicacion] = useState<string>('')
  const [visitas, setVisitas] = useState<VisitaTentativa[]>([
    { id: 'v1', fecha: null, hora: '', period: 'AM', showDate: false, showTime: false },
  ])

  // Calendar state for date picker – single month view per picker; we will use a global current month for simplicity
  const [calMonth, setCalMonth] = useState(() => new Date())

  useEffect(() => {
    let cancelled = false
    medicoService
      .list()
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data) && data.length > 0) {
          const mapped: MedicoPlan[] = data.map((b, idx) => ({
            id: String((b as unknown as { persona_id?: number }).persona_id || idx + 1),
            nombre: (b as unknown as { nombre?: string }).nombre || `Médico ${(b as unknown as { codigo?: string }).codigo || idx + 1}`,
            especialidad: String((b as unknown as { especialidad?: string }).especialidad || (b as unknown as { especialidad_id?: number }).especialidad_id || 'General'),
            ubicaciones: (() => {
              try {
                const d = (b as unknown as { direccion?: unknown }).direccion
                if (typeof d === 'string') {
                  const p = JSON.parse(d)
                  return Array.isArray(p) ? (p as Ubicacion[]) : [{ id: 'u1', direccion: String(d), detalle: '', coords: [-0.18, -78.46] as [number, number] }]
                }
                if (Array.isArray(d)) return d as Ubicacion[]
              } catch {
                // ignore
              }
              return [{ id: 'u1', direccion: (b as unknown as { institucion?: string }).institucion || 'Sin dirección', detalle: '', coords: [-0.18, -78.46] as [number, number] }]
            })(),
          }))
          if (!cancelled) {
            setMedicos(mapped)
            setSelectedMedico(mapped[0].id)
            setSelectedUbicacion(mapped[0].ubicaciones[0]?.id || '')
          }
        }
      })
      .catch(() => {
        // sin datos en BD, permanece vacío sin fallback
      })
    return () => {
      cancelled = true
    }
  }, [])

  const medico = useMemo(() => medicos.find((m) => m.id === selectedMedico) || null, [medicos, selectedMedico])
  const ubicaciones = medico?.ubicaciones || []

  // when medico changes, reset ubicacion to first
  const handleMedicoChange = (id: string) => {
    setSelectedMedico(id)
    const m = medicos.find((x) => x.id === id)
    if (m) setSelectedUbicacion(m.ubicaciones[0]?.id || '')
  }

  const updateVisita = (id: string, patch: Partial<VisitaTentativa>) => {
    setVisitas(prev => prev.map(v => (v.id === id ? { ...v, ...patch } : v)))
  }

  const addVisita = () => {
    setVisitas(prev => [...prev, { id: `v${Date.now()}`, fecha: null, hora: '', period: 'AM', showDate: false, showTime: false }])
  }

  const removeVisita = (id: string) => {
    setVisitas(prev => (prev.length <= 1 ? prev : prev.filter(v => v.id !== id)))
  }

  const handleRegistrar = () => {
    if (!medico) {
      alert('No hay médicos en la base de datos - sin datos para planificar')
      return
    }
    const ubic = ubicaciones.find((u) => u.id === selectedUbicacion)
    const payload = {
      medico,
      ubicacion: ubic,
      visitas: visitas.map((v) => ({
        fecha: v.fecha ? v.fecha.toLocaleDateString('es-BO') : null,
        fechaISO: v.fecha?.toISOString() ?? null,
        hora: v.hora ? `${v.hora} ${v.period}` : null,
      })),
    }
    console.log('[Planificador] registrar', payload)
    alert(`Planificación registrada para ${medico.nombre} en ${ubic?.direccion} con ${visitas.length} visita(s) tentativa(s)`)
  }

  // helpers for calendar rendering
  const renderCalendar = (visitaId: string) => {
    const y = calMonth.getFullYear()
    const m = calMonth.getMonth()
    const days = new Date(y, m + 1, 0).getDate()
    const firstDay = new Date(y, m, 1).getDay() // 0 dom
    const offset = firstDay === 0 ? 6 : firstDay - 1 // lun=0
    const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
    while (cells.length % 7 !== 0) cells.push(null)
    const monthLabel = calMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    return (
      <div className="plan-cal">
        <div className="plan-cal-head">
          <button type="button" className="plan-cal-nav" onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button>
          <span className="plan-cal-month">{monthLabel}</span>
          <button type="button" className="plan-cal-nav" onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button>
        </div>
        <div className="plan-cal-weekdays"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div>
        <div className="plan-cal-grid">
          {cells.map((d, i) =>
            d === null ? (
              <span key={i} className="plan-cal-cell muted" />
            ) : (
              <button
                key={i}
                type="button"
                className="plan-cal-cell"
                onClick={() => {
                  const nd = new Date(y, m, d)
                  updateVisita(visitaId, { fecha: nd, showDate: false })
                }}
              >
                {d}
              </button>
            ),
          )}
        </div>
      </div>
    )
  }

  const renderTimePicker = (visita: VisitaTentativa) => {
    const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
    const minutes = ['00', '15', '30', '45']
    const currentHour = visita.hora ? visita.hora.split(':')[0] : ''
    const currentMin = visita.hora ? visita.hora.split(':')[1] : ''
    return (
      <div className="plan-time">
        <div className="plan-time-row">
          <span className="plan-time-label">Hora</span>
          <div className="plan-time-grid">
            {hours.map(h => (
              <button
                key={h}
                type="button"
                className={`plan-time-btn ${currentHour === h ? 'active' : ''}`}
                onClick={() => {
                  const min = currentMin || '00'
                  updateVisita(visita.id, { hora: `${h}:${min}` })
                }}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
        <div className="plan-time-row">
          <span className="plan-time-label">Min</span>
          <div className="plan-time-grid">
            {minutes.map(m => (
              <button
                key={m}
                type="button"
                className={`plan-time-btn ${currentMin === m ? 'active' : ''}`}
                onClick={() => {
                  const h = currentHour || '09'
                  updateVisita(visita.id, { hora: `${h}:${m}` })
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="plan-time-row">
          <span className="plan-time-label">Periodo</span>
          <div className="plan-ampm">
            <button
              type="button"
              className={`plan-ampm-btn ${visita.period === 'AM' ? 'active' : ''}`}
              onClick={() => updateVisita(visita.id, { period: 'AM' })}
            >
              AM
            </button>
            <button
              type="button"
              className={`plan-ampm-btn ${visita.period === 'PM' ? 'active' : ''}`}
              onClick={() => updateVisita(visita.id, { period: 'PM' })}
            >
              PM
            </button>
          </div>
        </div>
        <div className="plan-time-actions">
          <button type="button" className="plan-time-ok" onClick={() => updateVisita(visita.id, { showTime: false })}>
            Aceptar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="plan-page">
      <header className="plan-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Planificador</h1>
        <button className="icon-btn notification-btn" aria-label="Notificaciones" onClick={() => onNavigate('notificaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <span className="notification-dot" />
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate} currentView={currentView} onLogout={onLogout} />

      <div className="plan-content">
        <div className="plan-card">
          <h2 className="plan-title">Planificar visita</h2>
          <p className="plan-sub">Selecciona médico y ubicación para proponer fechas tentativas.</p>

          <div className="plan-field">
            <label className="plan-label">Médico</label>
            {medicos.length === 0 ? (
              <p style={{ fontSize: 12, color: '#7e8aa6', padding: '8px 0' }}>No hay médicos - sin datos en BD</p>
            ) : (
              <select className="plan-select" value={selectedMedico} onChange={(e) => handleMedicoChange(e.target.value)}>
                {medicos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} — {m.especialidad}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="plan-field">
            <label className="plan-label">Ubicación</label>
            {ubicaciones.length === 0 ? (
              <p style={{ fontSize: 12, color: '#7e8aa6', padding: '8px 0' }}>Sin ubicaciones - sin datos en BD</p>
            ) : (
              <>
                <select className="plan-select" value={selectedUbicacion} onChange={(e) => setSelectedUbicacion(e.target.value)}>
                  {ubicaciones.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.direccion} {u.detalle ? `— ${u.detalle}` : ''}
                    </option>
                  ))}
                </select>
                <span className="plan-hint">{ubicaciones.find((u) => u.id === selectedUbicacion)?.detalle}</span>
              </>
            )}
          </div>
        </div>

        <div className="plan-card">
          <div className="plan-visitas-head">
            <h3 className="plan-visitas-title">Visitas tentativas</h3>
            <span className="plan-visitas-count">{visitas.length} {visitas.length === 1 ? 'visita' : 'visitas'}</span>
          </div>
          <p className="plan-sub" style={{ marginTop: 0 }}>Agrega una o más visitas. Usa botones para elegir fecha y hora (AM/PM).</p>

          <div className="plan-visitas-list">
            {visitas.map((v, idx) => (
              <div key={v.id} className="plan-visita-item">
                <div className="plan-visita-header">
                  <span className="plan-visita-index">Visita {idx + 1}</span>
                  <button type="button" className="plan-visita-remove" onClick={() => removeVisita(v.id)} disabled={visitas.length <= 1}>
                    Quitar
                  </button>
                </div>

                <div className="plan-visita-grid">
                  <div className="plan-field" style={{ margin: 0 }}>
                    <label className="plan-label">Fecha tentativa</label>
                    <button
                      type="button"
                      className={`plan-picker-btn ${v.fecha ? 'has-value' : ''}`}
                      onClick={() => updateVisita(v.id, { showDate: !v.showDate, showTime: false })}
                    >
                      {v.fecha ? v.fecha.toLocaleDateString('es-BO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : 'Seleccionar fecha'}
                    </button>
                    {v.showDate && renderCalendar(v.id)}
                  </div>

                  <div className="plan-field" style={{ margin: 0 }}>
                    <label className="plan-label">Hora tentativa</label>
                    <button
                      type="button"
                      className={`plan-picker-btn ${v.hora ? 'has-value' : ''}`}
                      onClick={() => updateVisita(v.id, { showTime: !v.showTime, showDate: false })}
                    >
                      {v.hora ? `${v.hora} ${v.period}` : 'Seleccionar hora'}
                    </button>
                    {v.showTime && renderTimePicker(v)}
                  </div>
                </div>

                {(v.fecha || v.hora) && (
                  <div className="plan-visita-preview">
                    Selección: {v.fecha ? v.fecha.toLocaleDateString('es-BO') : '—'} {v.hora ? `a las ${v.hora} ${v.period}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button type="button" className="plan-add-btn" onClick={addVisita}>
            + Agregar visita
          </button>
        </div>

        <button type="button" className="plan-submit" onClick={handleRegistrar}>
          Registrar planificación
        </button>
      </div>
    </div>
  )
}
