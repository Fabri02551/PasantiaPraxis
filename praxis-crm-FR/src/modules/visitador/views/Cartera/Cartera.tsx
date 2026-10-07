import { useState, useMemo, useEffect } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { authService, type CurrentUser } from '../../../auth/services/auth.service'
import { medicoService } from '../../../core/services/medico.service'
import { institucionService, type InstitucionBE } from '../../../core/services/institucion.service'
import { personaService } from '../../../core/services/persona.service'
import { especialidadService } from '../../../core/services/especialidad.service'
import { displayMedico } from '../../../core/utils/medicoPrefix'
import { hospitalFromDireccion, firstDireccionTexto } from '../../../core/utils/medicoDireccion'
import './Cartera.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'instituciones' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

// La cartera mezcla médicos e instituciones: un solo tipo para ambos.
type EntradaCartera = {
  id: string
  tipo: 'medico' | 'institucion'
  nombre: string
  sexo?: string
  subtitulo: string // especialidad (médico) | tipo de contrato (institución)
  ubicacion: string // hospital | dirección
}

export const CarteraView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<EntradaCartera | null>(null)
  const [entradas, setEntradas] = useState<EntradaCartera[]>([])
  const [usuario, setUsuario] = useState<CurrentUser | null>(null)
  const [conteos, setConteos] = useState({ medicos: 0, instituciones: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([authService.getMe(), medicoService.list().catch(() => []), institucionService.list().catch(() => []), especialidadService.list().catch(() => [])])
      .then(async ([me, medicosRaw, institucionesRaw, especialidadesRaw]) => {
        if (cancelled) return
        const yo = me.persona_id
        const medicosME = (Array.isArray(medicosRaw) ? medicosRaw : []).filter((m) => m.visitador_id === yo)
        const institucionesME = (Array.isArray(institucionesRaw) ? institucionesRaw : []).filter((i) => i.visitador_id === yo)
        const especialidadDe = new Map<(typeof especialidadesRaw)[number]['id'], string>()
        if (Array.isArray(especialidadesRaw)) {
          especialidadesRaw.forEach((es) => especialidadDe.set(es.id, es.nombre))
        }

        const medicos: EntradaCartera[] = await Promise.all(medicosME.map(async (b) => {
          let nombre = `Médico ${b.matricula || b.persona_id}`
          let primerApellido = ''
          let segundoApellido = ''
          let sexo: string | undefined
          try {
            const p = await personaService.getById(b.persona_id)
            nombre = p.nombre || nombre
            primerApellido = p.primer_apellido || ''
            segundoApellido = p.segundo_apellido || ''
            sexo = p.sexo || undefined
            if (primerApellido) nombre = `${nombre} ${primerApellido}${segundoApellido ? ' ' + segundoApellido : ''}`.trim()
          } catch { /* sin persona, queda el fallback */ }
          return {
            id: String(b.persona_id),
            tipo: 'medico' as const,
            nombre,
            sexo,
            subtitulo: especialidadDe.get(b.especialidad_id) ?? String(b.especialidad_id),
            ubicacion: hospitalFromDireccion(b.direccion) || 'Sin institución',
          }
        }))

        const instituciones: EntradaCartera[] = (institucionesME as InstitucionBE[]).map((b) => ({
          id: String(b.id),
          tipo: 'institucion' as const,
          nombre: b.nombre || `Institución ${b.id}`,
subtitulo: b.tipo_contrato || 'Institución',
            ubicacion: firstDireccionTexto(b.direccion) || 'Sin dirección registrada',
        }))

        if (cancelled) return
        setUsuario(me)
        setConteos({ medicos: medicos.length, instituciones: instituciones.length })
        setEntradas([...medicos, ...instituciones])
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[Cartera] API no disponible', err)
        setEntradas([])
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
    if (!q) return entradas
    return entradas.filter((e) =>
      e.nombre.toLowerCase().includes(q) ||
      e.subtitulo.toLowerCase().includes(q) ||
      e.ubicacion.toLowerCase().includes(q) ||
      e.tipo.toLowerCase().includes(q),
    )
  }, [search, entradas])

  const resumenNombre = usuario ? [usuario.nombre, usuario.primer_apellido].filter(Boolean).join(' ').trim() : '…'
  const resumenAsignado = (e: EntradaCartera) => (e.tipo === 'medico' ? displayMedico(e.sexo, e.nombre) : e.nombre)

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
          <h2>Médicos y instituciones asignados a ti</h2>
          <p>
            {conteos.medicos} médicos · {conteos.instituciones} instituciones · <strong>{resumenNombre}</strong>
          </p>
          {loading && <p style={{ fontSize: 11, color: '#2d9c9c', marginTop: 4 }}>Cargando...</p>}
        </div>

        <div className="cartera-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a9ab5" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input className="cartera-search-input" placeholder="Buscar en mi cartera..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <ul className="cartera-list">
          {filtered.map(e => (
            <li key={`${e.tipo}-${e.id}`} className="cartera-card" onClick={() => setSelected(e)} role="button" tabIndex={0} onKeyDown={ev => ev.key === 'Enter' && setSelected(e)}>
              <div className="cartera-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="cartera-nombre">{resumenAsignado(e)}</span>
                  <span className={`cartera-tipo ${e.tipo === 'institucion' ? 'cartera-tipo--institucion' : ''}`}>{e.tipo === 'medico' ? 'Médico' : 'Institución'}</span>
                </div>
                <span className="cartera-esp">{e.subtitulo}</span>
                <span className="cartera-hosp"><span className="cartera-dot" />{e.ubicacion}</span>
              </div>
              <span className="cartera-chevron">›</span>
            </li>
          ))}
        </ul>

        {!loading && filtered.length === 0 && (
          <p className="cartera-empty">
            {entradas.length === 0
              ? `No tienes médicos ni instituciones asignados${usuario ? ` (${resumenNombre})` : ''}`
              : 'Sin resultados en tu cartera.'}
          </p>
        )}

        {selected && (
          <div className="cartera-overlay" onClick={() => setSelected(null)}>
            <div className="cartera-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="cartera-modal-header">
                <h3>{resumenAsignado(selected)}</h3>
                <button className="cartera-modal-close" onClick={() => setSelected(null)} aria-label="Cerrar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="cartera-modal-esp">{selected.subtitulo} · {selected.ubicacion}</p>
              <div className="cartera-modal-badge">✓ Asignado a ti ({selected.tipo === 'medico' ? 'médico' : 'institución'})</div>
              <button className="cartera-modal-primary" onClick={() => setSelected(null)}>Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}