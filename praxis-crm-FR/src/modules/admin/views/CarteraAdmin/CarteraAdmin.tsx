import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { visitadorService, type VisitadorBE } from '../../../core/services/visitador.service'
import { medicoService, type MedicoBE } from '../../../core/services/medico.service'
import { personaService } from '../../../core/services/persona.service'
import { especialidadService } from '../../../core/services/especialidad.service'
import { getInitials, avatarStyle } from '../../../core/utils/avatar'
import './CarteraAdmin.css'

interface Props {
  currentView: AdminView
  onNavigate: (v: AdminView) => void
  onLogout: () => void
}

type MedicoFila = {
  persona_id: number
  nombre: string
  matricula: string
  especialidad: string
  codigo?: string | null
}

const nombreVisitador = (v: VisitadorBE) =>
  [v.nombre, v.primer_apellido, v.segundo_apellido].filter(Boolean).join(' ').trim() || v.correo

export const CarteraAdminView: React.FC<Props> = ({ currentView, onNavigate, onLogout }) => {
  const [visitadores, setVisitadores] = useState<VisitadorBE[]>([])
  const [medicos, setMedicos] = useState<MedicoBE[]>([])
  const [especialidades, setEspecialidades] = useState<Record<number, string>>({})
  const [nombres, setNombres] = useState<Record<number, string>>({})
  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.allSettled([visitadorService.list(), medicoService.list(), especialidadService.list()])
      .then(async (res) => {
        if (cancelled) return
        const vt = res[0].status === 'fulfilled' && Array.isArray(res[0].value) ? res[0].value : []
        const md = res[1].status === 'fulfilled' && Array.isArray(res[1].value) ? res[1].value : []
        const es = res[2].status === 'fulfilled' && Array.isArray(res[2].value) ? res[2].value : []
        if (res[0].status !== 'fulfilled' || res[1].status !== 'fulfilled') {
          setError('No se pudo cargar la cartera')
        }
        const esp: Record<number, string> = {}
        es.forEach((e: { id: number; nombre: string }) => { esp[e.id] = e.nombre })
        setVisitadores(vt)
        setMedicos(md)
        setEspecialidades(esp)
        if (vt.length > 0) setSeleccionado(vt[0].persona_id)
        // Nombres de todos los médicos con visitador asignado.
        const ids = [...new Set(md.filter((m) => m.visitador_id != null).map((m) => m.persona_id))]
        const map: Record<number, string> = {}
        await Promise.all(ids.map(async (id) => {
          try {
            const p = await personaService.getById(id)
            map[id] = [p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ').trim() || `Médico ${id}`
          } catch {
            map[id] = `Médico ${id}`
          }
        }))
        if (!cancelled) setNombres(map)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const conteoPorVisitador = useMemo(() => {
    const map = new Map<number, number>()
    medicos.forEach((m) => {
      if (m.visitador_id == null) return
      map.set(m.visitador_id, (map.get(m.visitador_id) ?? 0) + 1)
    })
    return map
  }, [medicos])

  const filas = useMemo<MedicoFila[]>(() => {
    if (seleccionado == null) return []
    const q = busqueda.trim().toLowerCase()
    return medicos
      .filter((m) => m.visitador_id === seleccionado)
      .map((m) => ({
        persona_id: m.persona_id,
        nombre: nombres[m.persona_id] ?? `Médico ${m.matricula || m.persona_id}`,
        matricula: m.matricula,
        especialidad: especialidades[m.especialidad_id] ?? '—',
        codigo: m.codigo,
      }))
      .filter((f) => !q || f.nombre.toLowerCase().includes(q) || f.matricula.toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [medicos, seleccionado, nombres, especialidades, busqueda])

  const visitadorSel = visitadores.find((v) => v.persona_id === seleccionado) ?? null

  return (
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Cartera por visitador">
      <div className="cartera-admin-layout">
        <aside className="cartera-admin-list">
          <h2 className="cartera-admin-subtitle">Visitadores ({visitadores.length})</h2>
          {loading ? (
            <p className="cartera-admin-status">Cargando…</p>
          ) : error && visitadores.length === 0 ? (
            <p className="cartera-admin-status cartera-admin-error">{error}</p>
          ) : (
            <ul className="cartera-admin-visitadores">
              {visitadores.map((v) => {
                const n = nombreVisitador(v)
                const active = v.persona_id === seleccionado
                return (
                  <li key={v.persona_id}>
                    <button
                      className={`cartera-admin-item ${active ? 'active' : ''}`}
                      onClick={() => { setSeleccionado(v.persona_id); setBusqueda('') }}
                    >
                      <span className="cartera-admin-avatar" style={avatarStyle(n)} aria-hidden>
                        {getInitials(v.nombre, v.primer_apellido, v.segundo_apellido)}
                      </span>
                      <span className="cartera-admin-item-text">
                        <span className="cartera-admin-item-name">{n}</span>
                        <span className="cartera-admin-item-count">
                          {conteoPorVisitador.get(v.persona_id) ?? 0} médicos
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        <section className="cartera-admin-detail">
          {visitadorSel == null ? (
            <p className="cartera-admin-status">Selecciona un visitador para ver su cartera.</p>
          ) : (
            <>
              <div className="cartera-admin-head">
                <div>
                  <h2 className="cartera-admin-title">{nombreVisitador(visitadorSel)}</h2>
                  <p className="cartera-admin-sub">{filas.length} médicos asignados</p>
                </div>
                <input
                  className="cartera-admin-search"
                  placeholder="Buscar por nombre o matrícula…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
              {filas.length === 0 ? (
                <p className="cartera-admin-status">
                  {busqueda ? 'Sin coincidencias para esa búsqueda.' : 'Este visitador no tiene médicos asignados.'}
                </p>
              ) : (
                <ul className="cartera-admin-medicos">
                  {filas.map((f) => (
                    <li key={f.persona_id} className="cartera-admin-medico">
                      <span className="cartera-admin-avatar" style={avatarStyle(f.nombre)} aria-hidden>
                        {getInitials(f.nombre)}
                      </span>
                      <span className="cartera-admin-medico-text">
                        <span className="cartera-admin-medico-name">{f.nombre}</span>
                        <span className="cartera-admin-medico-sub">
                          {f.especialidad} · Mat. {f.matricula}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </AdminLayout>
  )
}

export default CarteraAdminView
