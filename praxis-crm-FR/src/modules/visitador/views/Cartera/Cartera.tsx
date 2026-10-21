import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { authService, type CurrentUser } from '../../../auth/services/auth.service'
import { medicoService } from '../../../core/services/medico.service'
import { institucionService, type InstitucionBE } from '../../../core/services/institucion.service'
import { personaService } from '../../../core/services/persona.service'
import { especialidadService, type Especialidad } from '../../../core/services/especialidad.service'
import { ciudadService, type Ciudad } from '../../../core/services/ciudad.service'
import { ClasificacionPicker } from '../../../core/components/ClasificacionPicker/ClasificacionPicker'
import { MapPicker } from '../../../admin/components/MapPicker/MapPicker'
import { Toast } from '../../../core/components/Toast/Toast'
import { displayMedico } from '../../../core/utils/medicoPrefix'
import { hospitalFromDireccion, firstDireccionTexto, normalizeUbicaciones, type UbicacionMedico } from '../../../core/utils/medicoDireccion'
import './Cartera.css'
import '../../../admin/views/Visitadores/Visitadores.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'instituciones' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

type EntradaCartera = {
  id: string
  tipo: 'medico' | 'institucion'
  nombre: string
  sexo?: string
  subtitulo: string // especialidad (médico) | tipo de contrato (institución)
  ubicacion: string // hospital | dirección
}

interface EditMedicoForm {
  id: string
  nombre: string
  primerApellido: string
  segundoApellido: string
  sexo: string
  matricula: string
  especialidad: string
  telefono: string
  email: string
  ci: string
  descripcion: string
  ciudad: string
  esParticular: boolean
  clasificacion: number
  ubicaciones: UbicacionMedico[]
}

const reqLabelStyle: React.CSSProperties = { color: '#8a9ab5', fontWeight: 400, fontSize: 10, opacity: 0.85, marginLeft: 4, textTransform: 'lowercase' }
const optLabelStyle: React.CSSProperties = { color: '#8a9ab5', fontWeight: 400, fontSize: 10, opacity: 0.75, marginLeft: 4, textTransform: 'lowercase' }

export const CarteraView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<EntradaCartera | null>(null)
  const [entradas, setEntradas] = useState<EntradaCartera[]>([])
  const [usuario, setUsuario] = useState<CurrentUser | null>(null)
  const [conteos, setConteos] = useState({ medicos: 0, instituciones: 0 })
  const [loading, setLoading] = useState(false)

  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [ciudades, setCiudades] = useState<Ciudad[]>([])

  // Estado para la edición de médico
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<EditMedicoForm | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  // Baja lógica de médico (solo cartera propia): pide confirmación en modal.
  const [deleting, setDeleting] = useState<EntradaCartera | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  useEffect(() => {
    especialidadService.list().then(data => setEspecialidades(Array.isArray(data) ? data : [])).catch(() => setEspecialidades([]))
    ciudadService.list().then(data => setCiudades(Array.isArray(data) ? data.filter(c => c.status !== false) : [])).catch(() => setCiudades([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    authService.getMe()
      .then(async (me) => {
        if (cancelled) return
        setUsuario(me)
        const yo = me.persona_id
        if (!yo) {
          setLoading(false)
          return
        }

        const [medicosRes, institucionesRaw, espRaw] = await Promise.all([
          medicoService.listByVisitador(yo).catch(() => medicoService.list().then(list => (Array.isArray(list) ? list.filter(m => m.visitador_id === yo) : [])).catch(() => [])),
          institucionService.list().catch(() => []),
          especialidadService.list().catch(() => []),
        ])

        if (cancelled) return

        const especialidadDe = new Map<(typeof espRaw)[number]['id'], string>()
        if (Array.isArray(espRaw)) {
          espRaw.forEach((es) => especialidadDe.set(es.id, es.nombre))
        }

        const institucionesME = (Array.isArray(institucionesRaw) ? institucionesRaw : []).filter((i) => i.visitador_id === yo)

        const medicos: EntradaCartera[] = await Promise.all((medicosRes || []).map(async (b) => {
          let nombre = ''
          let sexo = b.sexo || undefined
          if (b.nombre) {
            nombre = `${b.nombre} ${b.primer_apellido || ''}${b.segundo_apellido ? ' ' + b.segundo_apellido : ''}`.trim()
          } else {
            try {
              const p = await personaService.getById(b.persona_id)
              nombre = `${p.nombre || ''} ${p.primer_apellido || ''}${p.segundo_apellido ? ' ' + p.segundo_apellido : ''}`.trim()
              sexo = p.sexo || undefined
            } catch {
              nombre = `Médico ${b.matricula || b.persona_id}`
            }
          }

          return {
            id: String(b.persona_id),
            tipo: 'medico' as const,
            nombre: nombre || `Médico ${b.matricula || b.persona_id}`,
            sexo,
            subtitulo: b.especialidad || especialidadDe.get(b.especialidad_id) || String(b.especialidad_id),
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
        setConteos({ medicos: medicos.length, instituciones: instituciones.length })
        setEntradas([...medicos, ...instituciones])
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[Cartera] Error al cargar cartera', err)
        setEntradas([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleStartEdit = async (entrada: EntradaCartera) => {
    if (entrada.tipo !== 'medico') return
    const pid = Number(entrada.id)
    setLoadingEdit(true)
    try {
      const [medico, persona] = await Promise.all([
        medicoService.getById(pid),
        personaService.getById(pid).catch(() => null),
      ])

      const ubicaciones = normalizeUbicaciones(medico.direccion)
      let descripcion = ''
      if (medico.notas && typeof medico.notas === 'object' && 'descripcion' in (medico.notas as Record<string, unknown>)) {
        descripcion = String((medico.notas as Record<string, unknown>).descripcion || '')
      }

      setEditForm({
        id: String(pid),
        nombre: persona?.nombre || '',
        primerApellido: persona?.primer_apellido || '',
        segundoApellido: persona?.segundo_apellido || '',
        sexo: persona?.sexo || entrada.sexo || '',
        matricula: medico.matricula || '',
        especialidad: String(medico.especialidad_id || ''),
        telefono: persona?.telefono || '',
        email: persona?.correo || '',
        ci: persona?.ci || '',
        descripcion,
        ciudad: persona?.ciudad_id ? String(persona.ciudad_id) : '',
        esParticular: medico.es_particular ?? true,
        clasificacion: medico.clasificacion ?? 1,
        ubicaciones: ubicaciones.length > 0 ? ubicaciones : [{ id: 'u0', direccion: '', detalle: '', coords: [-0.1807, -78.4678] }],
      })
      setSelected(null)
      setEditing(true)
    } catch (err) {
      console.warn('[Cartera] Error al cargar médico para editar', err)
      showToast('Error al cargar datos del médico', 'error')
    } finally {
      setLoadingEdit(false)
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm || savingRef.current) return
    if (!editForm.nombre.trim() || !editForm.primerApellido.trim()) {
      showToast('Nombre y primer apellido son obligatorios', 'error')
      return
    }
    if (!editForm.matricula.trim()) {
      showToast('La matrícula es obligatoria', 'error')
      return
    }
    if (!editForm.especialidad) {
      showToast('La especialidad es obligatoria', 'error')
      return
    }
    if (!editForm.sexo) {
      showToast('El sexo es obligatorio', 'error')
      return
    }

    const pid = Number(editForm.id)
    const ubicacionesValidas = editForm.ubicaciones.filter(u => u.direccion.trim() || u.detalle.trim())

    savingRef.current = true
    setSaving(true)
    try {
      await personaService.update(pid, {
        nombre: editForm.nombre.trim(),
        primer_apellido: editForm.primerApellido.trim(),
        segundo_apellido: editForm.segundoApellido.trim(),
        sexo: editForm.sexo,
        correo: editForm.email.trim(),
        telefono: editForm.telefono.trim(),
        ci: editForm.ci.trim(),
        ciudad_id: editForm.ciudad ? Number(editForm.ciudad) : null,
      })

      await medicoService.update(pid, {
        matricula: editForm.matricula.trim(),
        especialidad_id: Number(editForm.especialidad),
        es_particular: editForm.esParticular,
        clasificacion: editForm.clasificacion,
        direccion: ubicacionesValidas,
        notas: editForm.descripcion.trim() ? { descripcion: editForm.descripcion.trim() } : undefined,
      })

      const espNombre = especialidades.find(es => String(es.id) === editForm.especialidad)?.nombre || editForm.especialidad
      const nuevoNombre = `${editForm.nombre.trim()} ${editForm.primerApellido.trim()}${editForm.segundoApellido.trim() ? ' ' + editForm.segundoApellido.trim() : ''}`.trim()
      const nuevaUbi = hospitalFromDireccion(ubicacionesValidas) || 'Sin institución'

      setEntradas(prev => prev.map(item => {
        if (item.tipo === 'medico' && item.id === editForm.id) {
          return {
            ...item,
            nombre: nuevoNombre,
            sexo: editForm.sexo,
            subtitulo: espNombre,
            ubicacion: nuevaUbi,
          }
        }
        return item
      }))

      showToast(`Médico actualizado ✓ ${nuevoNombre}`, 'success')
      setEditing(false)
      setEditForm(null)
    } catch (err) {
      console.warn('[Cartera] Error al actualizar médico', err)
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`No se actualizó ✗ ${msg}`, 'error')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleting || deletingBusy) return
    const pid = Number(deleting.id)
    if (deleting.tipo !== 'medico' || !Number.isFinite(pid)) return
    setDeletingBusy(true)
    try {
      const res = await medicoService.remove(pid)
      setEntradas(prev => prev.filter(item => !(item.tipo === 'medico' && item.id === deleting.id)))
      setConteos(prev => ({ ...prev, medicos: Math.max(0, prev.medicos - 1) }))
      if (selected?.id === deleting.id && selected?.tipo === 'medico') setSelected(null)
      const mat = res?.matricula ? ` · nueva matrícula ${res.matricula}` : ''
      showToast(`Médico eliminado ✓ ${deleting.nombre}${mat}`, 'success')
      setDeleting(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`No se eliminó ✗ ${msg}`, 'error')
    } finally {
      setDeletingBusy(false)
    }
  }

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
          <h2>Médicos e instituciones asignados a ti</h2>
          <p>
            {conteos.medicos} médicos · {conteos.instituciones} instituciones · <strong>{resumenNombre}</strong>
          </p>
          {(loading || loadingEdit) && <p style={{ fontSize: 11, color: '#2d9c9c', marginTop: 4 }}>Cargando...</p>}
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
            <li
              key={`${e.tipo}-${e.id}`}
              className="cartera-card"
              onClick={() => (e.tipo === 'medico' ? handleStartEdit(e) : setSelected(e))}
              role="button"
              tabIndex={0}
              onKeyDown={ev => ev.key === 'Enter' && (e.tipo === 'medico' ? handleStartEdit(e) : setSelected(e))}
            >
              <div className="cartera-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="cartera-nombre">{resumenAsignado(e)}</span>
                  <span className={`cartera-tipo ${e.tipo === 'institucion' ? 'cartera-tipo--institucion' : ''}`}>{e.tipo === 'medico' ? 'Médico' : 'Institución'}</span>
                </div>
                <span className="cartera-esp">{e.subtitulo}</span>
                <span className="cartera-hosp"><span className="cartera-dot" />{e.ubicacion}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {e.tipo === 'medico' && (
                  <button
                    type="button"
                    className="vt-btn vt-btn--editar"
                    style={{ height: 28, fontSize: 11, padding: '0 10px', borderRadius: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      handleStartEdit(e)
                    }}
                    title="Editar médico"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Editar
                  </button>
                )}
                {e.tipo === 'medico' && (
                  <button
                    type="button"
                    className="vt-btn vt-btn--eliminar"
                    style={{ height: 28, fontSize: 11, padding: '0 10px', borderRadius: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      setDeleting(e)
                    }}
                    title="Eliminar médico de mi cartera"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    Eliminar
                  </button>
                )}
                <span className="cartera-chevron">›</span>
              </div>
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
              <div style={{ display: 'flex', gap: 10 }}>
                {selected.tipo === 'medico' && (
                  <button
                    type="button"
                    className="vt-btn vt-btn--editar"
                    style={{ flex: 1, height: 40, borderRadius: 10, fontSize: 13, fontWeight: 700 }}
                    onClick={() => handleStartEdit(selected)}
                  >
                    Editar Médico
                  </button>
                )}
                {selected.tipo === 'medico' && (
                  <button
                    type="button"
                    className="vt-btn vt-btn--eliminar"
                    style={{ flex: 1, height: 40, borderRadius: 10, fontSize: 13, fontWeight: 700 }}
                    onClick={() => { setSelected(null); setDeleting(selected) }}
                  >
                    Eliminar
                  </button>
                )}
                <button className="cartera-modal-primary" style={{ flex: 1, height: 40 }} onClick={() => setSelected(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {deleting && (
          <div className="cartera-overlay" onClick={() => { if (!deletingBusy) setDeleting(null) }}>
            <div className="cartera-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Confirmar eliminación">
              <div className="cartera-modal-header">
                <h3>Eliminar médico</h3>
                <button className="cartera-modal-close" onClick={() => { if (!deletingBusy) setDeleting(null) }} aria-label="Cerrar" disabled={deletingBusy}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 12px' }} aria-hidden>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <path d="M12 9v4M12 17h.01" />
                </svg>
              </div>
              <p className="cartera-modal-esp" style={{ textAlign: 'center' }}>
                Seguro quieres eliminar a este medico: <strong style={{ color: '#1B2A4E' }}>{resumenAsignado(deleting)}</strong>
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="vt-btn-cancel"
                  style={{ flex: 1, height: 40, borderRadius: 10, fontSize: 13, fontWeight: 700 }}
                  onClick={() => setDeleting(null)}
                  disabled={deletingBusy}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="vt-btn vt-btn--eliminar"
                  style={{ flex: 1, height: 40, borderRadius: 10, fontSize: 13, fontWeight: 700, opacity: deletingBusy ? 0.6 : 1 }}
                  onClick={handleConfirmDelete}
                  disabled={deletingBusy}
                >
                  {deletingBusy ? 'Eliminando…' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {editing && editForm && (
          <div className="vt-overlay" onClick={() => { if (!savingRef.current) { setEditing(false); setEditForm(null) } }} style={{ zIndex: 3000 }}>
            <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="vt-modal-head">
                <h3>Editar Médico</h3>
                <button className="vt-modal-close" onClick={() => { if (!savingRef.current) { setEditing(false); setEditForm(null) } }} aria-label="Cerrar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <form onSubmit={handleSaveEdit} className="vt-form">
                <label>Nombre <span style={reqLabelStyle}>* obligatorio</span><input required value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} placeholder="Ej. Juan" /></label>
                <label>Primer Apellido <span style={reqLabelStyle}>* obligatorio</span><input required value={editForm.primerApellido} onChange={e => setEditForm({ ...editForm, primerApellido: e.target.value })} placeholder="Ej. Pérez" /></label>
                <label>Segundo Apellido <span style={optLabelStyle}>(opcional)</span><input value={editForm.segundoApellido} onChange={e => setEditForm({ ...editForm, segundoApellido: e.target.value })} placeholder="Ej. López" /></label>
                <label>Sexo <span style={reqLabelStyle}>* obligatorio</span>
                  <select required value={editForm.sexo} onChange={e => setEditForm({ ...editForm, sexo: e.target.value })}>
                    <option value="">Seleccione sexo</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                  </select>
                </label>
                <label>Matrícula <span style={reqLabelStyle}>* obligatorio</span><input required value={editForm.matricula} onChange={e => setEditForm({ ...editForm, matricula: e.target.value })} placeholder="MED-12345" /></label>
                <label>Especialidad <span style={reqLabelStyle}>* obligatorio</span>
                  <select required value={editForm.especialidad} onChange={e => setEditForm({ ...editForm, especialidad: e.target.value })}>
                    <option value="">Seleccione especialidad</option>
                    {(especialidades ?? []).map(es => <option key={es.id} value={String(es.id)}>{es.nombre} ({es.codigo})</option>)}
                  </select>
                </label>
                <label>Teléfono <span style={optLabelStyle}>(opcional)</span><input value={editForm.telefono} onChange={e => setEditForm({ ...editForm, telefono: e.target.value })} placeholder="0999999999" /></label>
                <label>Correo / Email <span style={optLabelStyle}>(opcional)</span><input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} placeholder="ejemplo@correo.com" /></label>
                <label>CI <span style={optLabelStyle}>(opcional)</span><input value={editForm.ci} onChange={e => setEditForm({ ...editForm, ci: e.target.value })} placeholder="1712345678" /></label>
                <label>Ciudad <span style={optLabelStyle}>(opcional)</span>
                  <select value={editForm.ciudad} onChange={e => setEditForm({ ...editForm, ciudad: e.target.value })}>
                    <option value="">Seleccione ciudad</option>
                    {(ciudades ?? []).map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
                  </select>
                </label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#1B2A4E' }}>
                    <input type="checkbox" checked={editForm.esParticular} onChange={e => setEditForm({ ...editForm, esParticular: e.target.checked })} />
                    Particular
                  </label>
                  <div style={{ flex: 1.6 }}>
                    <ClasificacionPicker value={editForm.clasificacion} onChange={v => setEditForm({ ...editForm, clasificacion: v })} />
                  </div>
                </div>
                <label>Descripción / Notas <span style={optLabelStyle}>(opcional)</span><textarea value={editForm.descripcion} onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} placeholder="Notas adicionales" /></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E' }}>Ubicaciones</span>
                  {editForm.ubicaciones.map((u, idx) => (
                    <div key={u.id} style={{ border: '1px solid #e8ecf1', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: '#fcfcfd' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E' }}>Ubicación {idx + 1}</span>
                        <button type="button" className="vt-btn-cancel" onClick={() => setEditForm({ ...editForm, ubicaciones: editForm.ubicaciones.filter((_, i) => i !== idx) })} disabled={editForm.ubicaciones.length <= 1}>Quitar</button>
                      </div>
                      <label style={{ fontSize: 11, fontWeight: 600 }}>Dirección<input value={u.direccion} onChange={e => setEditForm({ ...editForm, ubicaciones: editForm.ubicaciones.map((x, i) => i === idx ? { ...x, direccion: e.target.value } : x) })} placeholder={`Dirección ${idx + 1}`} /></label>
                      <label style={{ fontSize: 11, fontWeight: 600 }}>Detalle de la ubicación<input value={u.detalle} onChange={e => setEditForm({ ...editForm, ubicaciones: editForm.ubicaciones.map((x, i) => i === idx ? { ...x, detalle: e.target.value } : x) })} placeholder="Ej. Consultorio 301, Torre Médica" /></label>
                      <MapPicker coords={u.coords} onChange={c => setEditForm({ ...editForm, ubicaciones: editForm.ubicaciones.map((x, i) => i === idx ? { ...x, coords: c } : x) })} height={140} />
                    </div>
                  ))}
                  <button type="button" className="vt-btn vt-btn--ver" onClick={() => setEditForm({ ...editForm, ubicaciones: [...editForm.ubicaciones, { id: `u${Date.now()}`, direccion: '', detalle: '', coords: [-0.1807, -78.4678] }] })} style={{ alignSelf: 'flex-start' }}>+ Agregar ubicación</button>
                </div>
                <div className="vt-form-actions">
                  <button type="button" className="vt-btn-cancel" onClick={() => { setEditing(false); setEditForm(null) }} disabled={saving}>Cancelar</button>
                  <button type="submit" className="vt-btn-submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar Cambios'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {saving && (
          <div className="medicos-busy" role="status" aria-live="polite">
            <span className="medicos-busy-spinner" />
            <span>Guardando…</span>
          </div>
        )}

        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </div>
  )
}