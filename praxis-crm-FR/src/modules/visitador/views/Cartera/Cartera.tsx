import { useState, useMemo, useEffect } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import type { Medico } from '../Medicos/Medicos'
import { medicoService } from '../../../core/services/medico.service'
import { personaService } from '../../../core/services/persona.service'
import { ENV } from '../../../core/config/env'
import { displayMedico } from '../../../core/utils/medicoPrefix'
import { hospitalFromDireccion } from '../../../core/utils/medicoDireccion'
import './Cartera.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

// Usuario actual – coincide con SidebarMenu / Profile
const VISITADOR_ACTUAL = 'Carlos Mendoza'

export const CarteraView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
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
      .then(async (data) => {
        if (cancelled) return
        if (Array.isArray(data) && data.length > 0) {
          const mapped: Medico[] = await Promise.all(data.map(async (b) => {
            let sexo: string | undefined
            let primerApellido = ''
            let segundoApellido = ''
            let nombre = `Médico ${b.matricula || b.persona_id}`
            try {
              const p = await personaService.getById(b.persona_id)
              nombre = p.nombre || nombre
              primerApellido = p.primer_apellido || ''
              segundoApellido = p.segundo_apellido || ''
              sexo = p.sexo || undefined
              if (primerApellido) nombre = `${nombre} ${primerApellido}${segundoApellido ? ' ' + segundoApellido : ''}`.trim()
            } catch { /* fallback */ }
            return {
              id: String(b.persona_id),
              nombre,
              sexo,
              especialidad: String(b.especialidad_id ?? 'General'),
              hospital: hospitalFromDireccion(b.direccion) || 'Sin institución',
              visitadorAsignado: null,
            }
          }))
          if (cancelled) return
          setMedicos(mapped)
          setApiStatus(`Conectado a ${ENV.API_URL} — ${data.length} médicos desde /api/medicos`)
        } else {
          setMedicos([])
          setApiStatus(`Conectado a ${ENV.API_URL} — sin datos`)
        }
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[Cartera] API no disponible', err)
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

  const cartera = useMemo(() => medicos.filter(m => m.visitadorAsignado === VISITADOR_ACTUAL), [medicos])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return cartera
    return cartera.filter(m => m.nombre.toLowerCase().includes(q) || m.especialidad.toLowerCase().includes(q) || m.hospital.toLowerCase().includes(q))
  }, [search, cartera])

  return (
    <div className="cartera-page">
      <header className="cartera-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Mi Cartera</h1>
        <button className="icon-btn notification-btn" aria-label="Notificaciones" onClick={() => onNavigate('notificaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate as any} currentView={currentView as any} onLogout={onLogout} />

      <div className="cartera-content">
        <div className="cartera-intro">
          <h2>Médicos asignados a ti</h2>
          <p>Solo ves los médicos de tu cartera personal. Asignación actual: <strong>{VISITADOR_ACTUAL}</strong> — {cartera.length} médicos</p>
          <p style={{ fontSize: 11, color: loading ? '#2d9c9c' : '#6b7a99', marginTop: 4 }}>{loading ? 'Cargando...' : apiStatus}</p>
        </div>

        <div className="cartera-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a9ab5" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input className="cartera-search-input" placeholder="Buscar en mi cartera..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <ul className="cartera-list">
          {filtered.map(m => (
            <li key={m.id} className="cartera-card" onClick={() => setSelected(m)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelected(m)}>
              <div className="cartera-info">
                <span className="cartera-nombre">{displayMedico(m.sexo, m.nombre)}</span>
                <span className="cartera-esp">{m.especialidad}</span>
                <span className="cartera-hosp"><span className="cartera-dot" />{m.hospital}</span>
                <span className="cartera-badge">Cartera: {m.visitadorAsignado}</span>
              </div>
              <span className="cartera-chevron">›</span>
            </li>
          ))}
        </ul>

        {!loading && filtered.length === 0 && <p className="cartera-empty">{cartera.length === 0 ? 'No tienes médicos asignados' : 'Sin resultados en tu cartera.'}</p>}

        {selected && (
          <div className="cartera-overlay" onClick={() => setSelected(null)}>
            <div className="cartera-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="cartera-modal-header">
                <h3>{displayMedico(selected.sexo, selected.nombre)}</h3>
                <button className="cartera-modal-close" onClick={() => setSelected(null)} aria-label="Cerrar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="cartera-modal-esp">{selected.especialidad} · {selected.hospital}</p>
              <div className="cartera-modal-badge">✓ Asignado a ti ({selected.visitadorAsignado})</div>
              <button className="cartera-modal-primary" onClick={() => setSelected(null)}>Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
