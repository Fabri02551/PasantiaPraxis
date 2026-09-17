import { useState, useMemo } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import './Historial.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

type EstadoHistorial = 'Realizada' | 'Por visitar' | 'Propuesta'

type HistorialVisit = {
  id: string
  fecha: string // e.g. "12 Oct 2024"
  hora: string // e.g. "10:00 AM"
  company: string
  detail: string
  estado: EstadoHistorial
  medico: { nombre: string; especialidad: string; hospital: string; phone: string }
  addr: string
  descripcion: string
}

const HISTORIAL: HistorialVisit[] = []

type Filtro = 'Todas' | EstadoHistorial

export const HistorialView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>('Todas')
  const [selected, setSelected] = useState<HistorialVisit | null>(null)

  const filtered = useMemo(() => {
    if (filtro === 'Todas') return HISTORIAL
    return HISTORIAL.filter(v => v.estado === filtro)
  }, [filtro])

  return (
    <div className="historial-page">
      <header className="historial-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Historial de Visitas</h1>
        <button className="icon-btn notification-btn" aria-label="Notificaciones" onClick={() => onNavigate('notificaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <span className="notification-dot" />
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate as any} currentView={currentView as any} onLogout={onLogout} />

      <div className="historial-content">
        <div className="historial-filters">
          {(['Todas', 'Realizada', 'Por visitar', 'Propuesta'] as Filtro[]).map(f => (
            <button key={f} className={`historial-filter-btn ${filtro === f ? 'active' : ''}`} onClick={() => setFiltro(f)}>
              {f === 'Realizada' ? 'Realizadas' : f}
            </button>
          ))}
        </div>

        <div className="historial-count">{filtered.length} visitas</div>

        <ul className="historial-list">
          {filtered.map(v => (
            <li key={v.id} className="historial-card" onClick={() => setSelected(v)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelected(v)}>
              <div className="historial-card-top">
                <span className="historial-fecha">{v.fecha} · {v.hora}</span>
                <span className={`historial-estado estado-${v.estado.toLowerCase().replace(' ', '-')}`}>{v.estado}</span>
              </div>
              <div className="historial-company">{v.company}</div>
              <div className="historial-detail">{v.detail}</div>
              <div className="historial-medico">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7a99" strokeWidth="1.8">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M5 20a7 7 0 0 1 14 0" />
                </svg>
                {v.medico.nombre} · {v.medico.especialidad}
              </div>
            </li>
          ))}
        </ul>

        {filtered.length === 0 && <p className="historial-empty">No hay visitas en historial - sin datos en BD</p>}

        {selected && (
          <div className="historial-overlay" onClick={() => setSelected(null)}>
            <div className="historial-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="historial-modal-header">
                <h3>{selected.company}</h3>
                <button className="historial-modal-close" onClick={() => setSelected(null)} aria-label="Cerrar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="historial-modal-body">
                <div className="historial-modal-row">
                  <span className="historial-modal-label">FECHA</span>
                  <span className="historial-modal-value">{selected.fecha}</span>
                </div>
                <div className="historial-modal-row">
                  <span className="historial-modal-label">HORA</span>
                  <span className="historial-modal-value">{selected.hora}</span>
                </div>
                <div className="historial-modal-row">
                  <span className="historial-modal-label">ESTADO</span>
                  <span className={`historial-estado estado-${selected.estado.toLowerCase().replace(' ', '-')}`}>{selected.estado}</span>
                </div>
                <div className="historial-modal-row">
                  <span className="historial-modal-label">DETALLE</span>
                  <span className="historial-modal-value">{selected.detail}</span>
                </div>
                <div className="historial-modal-row">
                  <span className="historial-modal-label">DIRECCIÓN</span>
                  <span className="historial-modal-value">{selected.addr}</span>
                </div>
                <div className="historial-modal-row">
                  <span className="historial-modal-label">DESCRIPCIÓN</span>
                  <p className="historial-modal-desc">{selected.descripcion}</p>
                </div>
                <div className="historial-medico-card">
                  <div className="historial-medico-avatar">{selected.medico.nombre.split(' ').slice(1).map(w => w[0]).join('').slice(0,2).toUpperCase()}</div>
                  <div>
                    <div className="historial-medico-nombre">{selected.medico.nombre}</div>
                    <div className="historial-medico-esp">{selected.medico.especialidad}</div>
                    <div className="historial-medico-hosp">{selected.medico.hospital}</div>
                    <div className="historial-medico-phone">{selected.medico.phone}</div>
                  </div>
                </div>
              </div>
              <button className="historial-modal-primary" onClick={() => setSelected(null)}>Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
