import { useState, useMemo, useEffect } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { medicoService } from '../../../core/services/medico.service'
import { ENV } from '../../../core/config/env'
import './Medicos.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

export type Medico = {
  id: string
  nombre: string
  especialidad: string
  hospital: string
  visitadorAsignado: string | null
}

export const MEDICOS: Medico[] = []

export const MedicosView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Medico | null>(null)
  const [medicos, setMedicos] = useState<Medico[]>([])
  const [apiStatus, setApiStatus] = useState(`API: ${ENV.API_URL}`)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    medicoService
      .list()
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data) && data.length > 0) {
          const mapped: Medico[] = data.map((b, idx) => ({
            id: String(b.persona_id || idx + 1),
            nombre: (b as unknown as { nombre?: string }).nombre || `Médico ${b.codigo || b.persona_id}`,
            especialidad: String((b as unknown as { especialidad?: string }).especialidad || b.especialidad_id || 'General'),
            hospital: b.institucion || 'Sin institución',
            visitadorAsignado: (b as unknown as { visitadorAsignado?: string | null }).visitadorAsignado ?? null,
          }))
          setMedicos(mapped)
          setApiStatus(`Conectado a ${ENV.API_URL} — ${data.length} médicos desde /api/medicos`)
        } else {
          setMedicos([])
          setApiStatus(`Conectado a ${ENV.API_URL} — sin datos`)
        }
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[Medicos] API no disponible', err)
        setMedicos([])
        setApiStatus(`Sin conexión a ${ENV.API_URL}`)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return medicos
    return medicos.filter(
      (m) => m.nombre.toLowerCase().includes(q) || m.especialidad.toLowerCase().includes(q) || m.hospital.toLowerCase().includes(q),
    )
  }, [search, medicos])

  return (
    <div className="medicos-page">
      <header className="medicos-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Médicos</h1>
        <button className="icon-btn notification-btn" aria-label="Notificaciones" onClick={() => onNavigate('notificaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate as any} currentView={currentView as any} onLogout={onLogout} />

      <div className="medicos-content">
        <div style={{ fontSize: 11, color: loading ? '#2d9c9c' : '#6b7a99', margin: '0 0 8px', fontWeight: 500 }}>{loading ? 'Cargando...' : apiStatus}</div>
        <div className="medicos-search-wrap">
          <svg className="medicos-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a9ab5" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            className="medicos-search-input"
            placeholder="Buscar médico o especialidad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="medicos-subheader">
          <span className="medicos-subtitle">Todos los médicos registrados</span>
          <span className="medicos-count">{filtered.length} resultados</span>
        </div>

        <ul className="medicos-list">
          {filtered.map((m) => (
            <li key={m.id} className="medico-card" onClick={() => setSelected(m)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelected(m)} style={{ cursor: 'pointer' }}>
              <div className="medico-info">
                <span className="medico-nombre">{m.nombre}</span>
                <span className="medico-especialidad">{m.especialidad}</span>
                <span className="medico-hospital">
                  <span className="medico-hospital-dot" />
                  {m.hospital}
                </span>
                <span className={`medico-visitador ${m.visitadorAsignado ? 'asignado' : 'no-asignado'}`}>
                  {m.visitadorAsignado ? `Visitador: ${m.visitadorAsignado}` : 'Sin visitador asignado'}
                </span>
              </div>
              <span className="medico-chevron">›</span>
            </li>
          ))}
        </ul>

        {!loading && filtered.length === 0 && (
          <p className="medicos-empty">{medicos.length === 0 ? 'No hay médicos registrados en la base de datos' : 'No se encontraron médicos'}</p>
        )}

        {selected && (
          <div className="medico-detail-overlay" onClick={() => setSelected(null)}>
            <div className="medico-detail-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="medico-detail-header">
                <h3>{selected.nombre}</h3>
                <button className="medico-detail-close" onClick={() => setSelected(null)} aria-label="Cerrar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="medico-detail-esp">{selected.especialidad} · {selected.hospital}</p>
              <div className={`medico-detail-asignado ${selected.visitadorAsignado ? 'asignado' : 'no-asignado'}`}>
                {selected.visitadorAsignado ? `✓ Visitador asignado: ${selected.visitadorAsignado}` : '○ Sin visitador asignado'}
              </div>
              <button className="medico-detail-primary" onClick={() => setSelected(null)}>Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const VisitadorMedicos = MedicosView
