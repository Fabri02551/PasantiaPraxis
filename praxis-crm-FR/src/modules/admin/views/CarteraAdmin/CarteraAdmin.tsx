import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { visitadorService, type VisitadorBE } from '../../../core/services/visitador.service'
import { medicoService } from '../../../core/services/medico.service'
import { personaService } from '../../../core/services/persona.service'
import { especialidadService, type Especialidad } from '../../../core/services/especialidad.service'
import { ciudadService, type Ciudad } from '../../../core/services/ciudad.service'
import { ClasificacionPicker } from '../../../core/components/ClasificacionPicker/ClasificacionPicker'
import { MapPicker } from '../../components/MapPicker/MapPicker'
import { Toast } from '../../../core/components/Toast/Toast'
import { getInitials, avatarStyle } from '../../../core/utils/avatar'
import { normalizeUbicaciones, type UbicacionMedico } from '../../../core/utils/medicoDireccion'
import { Paginador } from '../../../core/components/Paginador/Paginador'
import './CarteraAdmin.css'
import '../Visitadores/Visitadores.css'

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

const nombreVisitador = (v: VisitadorBE) =>
  [v.nombre, v.primer_apellido, v.segundo_apellido].filter(Boolean).join(' ').trim() || v.correo

export const CarteraAdminView: React.FC<Props> = ({ currentView, onNavigate, onLogout }) => {
  const [visitadores, setVisitadores] = useState<VisitadorBE[]>([])
  const [especialidadesLista, setEspecialidadesLista] = useState<Especialidad[]>([])
  const [especialidadesMap, setEspecialidadesMap] = useState<Record<number, string>>({})
  const [ciudades, setCiudades] = useState<Ciudad[]>([])
  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [loadingVisitadores, setLoadingVisitadores] = useState(true)
  const [loadingCartera, setLoadingCartera] = useState(false)
  const [errorVisitadores, setErrorVisitadores] = useState<string | null>(null)
  const [errorCartera, setErrorCartera] = useState<string | null>(null)
  const [pageMedicos, setPageMedicos] = useState(1)
  const PAGE_SIZE_MEDICOS = 12

  // Edición de médico
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<EditMedicoForm | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // Cache en memoria por visitador_id para que cambiar de visitador sea instantáneo
  const [carterasCache, setCarterasCache] = useState<Record<number, MedicoFila[]>>({})

  // Carga inicial: visitadores, especialidades y ciudades
  useEffect(() => {
    let cancelled = false
    setLoadingVisitadores(true)
    setErrorVisitadores(null)

    Promise.allSettled([visitadorService.list(), especialidadService.list(), ciudadService.list()])
      .then(([resVis, resEsp, resCiu]) => {
        if (cancelled) return

        if (resVis.status === 'fulfilled' && Array.isArray(resVis.value)) {
          setVisitadores(resVis.value)
          if (resVis.value.length > 0) {
            setSeleccionado(resVis.value[0].persona_id)
          }
        } else {
          setErrorVisitadores('No se pudo cargar la lista de visitadores.')
        }

        if (resEsp.status === 'fulfilled' && Array.isArray(resEsp.value)) {
          setEspecialidadesLista(resEsp.value)
          const esp: Record<number, string> = {}
          resEsp.value.forEach((e: { id: number; nombre: string }) => { esp[e.id] = e.nombre })
          setEspecialidadesMap(esp)
        }

        if (resCiu.status === 'fulfilled' && Array.isArray(resCiu.value)) {
          setCiudades(resCiu.value.filter(c => c.status !== false))
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingVisitadores(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Carga bajo demanda de la cartera del visitador seleccionado
  const cargarCartera = useCallback(
    async (vid: number) => {
      if (carterasCache[vid]) return

      setLoadingCartera(true)
      setErrorCartera(null)

      try {
        const medicos = await medicoService.listByVisitador(vid)
        const filas: MedicoFila[] = (medicos || []).map((m) => {
          let nombre = ''
          if (m.nombre) {
            nombre = `${m.nombre} ${m.primer_apellido || ''}${m.segundo_apellido ? ' ' + m.segundo_apellido : ''}`.trim()
          }
          if (!nombre) {
            nombre = `Médico ${m.matricula || m.persona_id}`
          }

          return {
            persona_id: m.persona_id,
            nombre,
            matricula: m.matricula || String(m.persona_id),
            especialidad: m.especialidad || especialidadesMap[m.especialidad_id] || 'General',
            codigo: m.codigo,
          }
        })

        setCarterasCache((prev) => ({ ...prev, [vid]: filas }))
      } catch (err) {
        console.warn(`[CarteraAdmin] error cargando cartera de visitador ${vid}`, err)
        setErrorCartera('No se pudo cargar la cartera de este visitador.')
      } finally {
        setLoadingCartera(false)
      }
    },
    [carterasCache, especialidadesMap]
  )

  useEffect(() => {
    if (seleccionado != null) {
      cargarCartera(seleccionado)
      setPageMedicos(1)
    }
  }, [seleccionado, cargarCartera])

  const visitadoresOrdenados = useMemo(() => {
    return [...visitadores].sort((a, b) => nombreVisitador(a).localeCompare(nombreVisitador(b), 'es'))
  }, [visitadores])

  const visitadorSel = useMemo(() => {
    return visitadores.find((v) => v.persona_id === seleccionado) || null
  }, [visitadores, seleccionado])

  const filasActuales = useMemo(() => {
    if (seleccionado == null) return []
    const list = carterasCache[seleccionado] || []
    const q = busqueda.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (f) =>
        f.nombre.toLowerCase().includes(q) ||
        f.matricula.toLowerCase().includes(q) ||
        f.especialidad.toLowerCase().includes(q)
    )
  }, [carterasCache, seleccionado, busqueda])

  useEffect(() => {
    setPageMedicos(1)
  }, [busqueda])

  const totalPagesMedicos = Math.max(1, Math.ceil(filasActuales.length / PAGE_SIZE_MEDICOS))
  const pagedMedicos = useMemo(() => {
    const start = (pageMedicos - 1) * PAGE_SIZE_MEDICOS
    return filasActuales.slice(start, start + PAGE_SIZE_MEDICOS)
  }, [filasActuales, pageMedicos])

  const handleStartEdit = async (f: MedicoFila) => {
    const pid = f.persona_id
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
        sexo: persona?.sexo || '',
        matricula: medico.matricula || f.matricula,
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
      setEditing(true)
    } catch (err) {
      console.warn('[CarteraAdmin] Error al cargar médico para editar', err)
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

      const espNombre = especialidadesLista.find(es => String(es.id) === editForm.especialidad)?.nombre || especialidadesMap[Number(editForm.especialidad)] || editForm.especialidad
      const nuevoNombre = `${editForm.nombre.trim()} ${editForm.primerApellido.trim()}${editForm.segundoApellido.trim() ? ' ' + editForm.segundoApellido.trim() : ''}`.trim()

      // Actualizar en el cache de carteras para que se refleje inmediatamente
      setCarterasCache(prev => {
        const next = { ...prev }
        for (const k of Object.keys(next)) {
          const numK = Number(k)
          next[numK] = next[numK].map(m => {
            if (m.persona_id === pid) {
              return {
                ...m,
                nombre: nuevoNombre,
                matricula: editForm.matricula.trim(),
                especialidad: espNombre,
              }
            }
            return m
          })
        }
        return next
      })

      showToast(`Médico actualizado ✓ ${nuevoNombre}`, 'success')
      setEditing(false)
      setEditForm(null)
    } catch (err) {
      console.warn('[CarteraAdmin] Error al actualizar médico', err)
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`No se actualizó ✗ ${msg}`, 'error')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Cartera de Visitadores">
      <div className="cartera-admin-layout">
        <aside className="cartera-admin-sidebar">
          <div className="cartera-admin-sidebar-header">
            <h3 className="cartera-admin-sidebar-title">Visitadores</h3>
            <span className="cartera-admin-badge">{visitadores.length}</span>
          </div>

          <div className="cartera-admin-sidebar-body">
            {loadingVisitadores ? (
              <p className="cartera-admin-status">Cargando visitadores…</p>
            ) : errorVisitadores ? (
              <p className="cartera-admin-status cartera-admin-error">{errorVisitadores}</p>
            ) : visitadoresOrdenados.length === 0 ? (
              <p className="cartera-admin-status">No hay visitadores registrados.</p>
            ) : (
              <ul className="cartera-admin-visitadores">
                {visitadoresOrdenados.map((v) => {
                  const active = v.persona_id === seleccionado
                  const n = nombreVisitador(v)
                  const count = carterasCache[v.persona_id]?.length ?? v.total_medicos ?? 0
                  return (
                    <li key={v.persona_id}>
                      <button
                        className={`cartera-admin-item ${active ? 'active' : ''}`}
                        onClick={() => {
                          setSeleccionado(v.persona_id)
                          setBusqueda('')
                        }}
                      >
                        <span className="cartera-admin-avatar" style={avatarStyle(n)} aria-hidden>
                          {getInitials(v.nombre, v.primer_apellido, v.segundo_apellido)}
                        </span>
                        <span className="cartera-admin-item-text">
                          <span className="cartera-admin-item-name">{n}</span>
                          <span className="cartera-admin-item-count">
                            {count} médicos
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="cartera-admin-detail">
          {visitadorSel == null ? (
            <div className="cartera-admin-detail-empty">
              <p className="cartera-admin-status">Selecciona un visitador para ver su cartera.</p>
            </div>
          ) : (
            <>
              <div className="cartera-admin-head">
                <div>
                  <h2 className="cartera-admin-title">{nombreVisitador(visitadorSel)}</h2>
                  <p className="cartera-admin-sub">
                    {loadingCartera && !carterasCache[visitadorSel.persona_id]
                      ? 'Cargando médicos…'
                      : `${filasActuales.length} médicos asignados`}
                  </p>
                </div>
                <input
                  className="cartera-admin-search"
                  placeholder="Buscar por nombre o matrícula…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>

              <div className="cartera-admin-detail-body">
                {loadingCartera && !carterasCache[visitadorSel.persona_id] ? (
                  <p className="cartera-admin-status">Cargando médicos de {nombreVisitador(visitadorSel)}…</p>
                ) : errorCartera && !carterasCache[visitadorSel.persona_id] ? (
                  <p className="cartera-admin-status cartera-admin-error">{errorCartera}</p>
                ) : filasActuales.length === 0 ? (
                  <p className="cartera-admin-status">
                    {busqueda ? 'Sin coincidencias para esa búsqueda.' : 'Este visitador no tiene médicos asignados.'}
                  </p>
                ) : (
                  <>
                    <ul className="cartera-admin-medicos">
                      {pagedMedicos.map((f) => (
                        <li
                          key={f.persona_id}
                          className="cartera-admin-medico"
                          onClick={() => handleStartEdit(f)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && handleStartEdit(f)}
                          style={{ cursor: 'pointer' }}
                        >
                          <span className="cartera-admin-avatar" style={avatarStyle(f.nombre)} aria-hidden>
                            {getInitials(f.nombre)}
                          </span>
                          <span className="cartera-admin-medico-text">
                            <span className="cartera-admin-medico-name">{f.nombre}</span>
                            <span className="cartera-admin-medico-sub">
                              {f.especialidad} · Mat. {f.matricula}
                            </span>
                          </span>
                          <button
                            type="button"
                            className="vt-btn vt-btn--editar"
                            style={{ height: 26, fontSize: 11, padding: '0 8px', borderRadius: 6, fontWeight: 700, marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={(ev) => {
                              ev.stopPropagation()
                              handleStartEdit(f)
                            }}
                            title="Editar médico"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Editar
                          </button>
                        </li>
                      ))}
                    </ul>
                    {totalPagesMedicos > 1 && (
                      <div className="cartera-admin-detail-footer">
                        <Paginador page={pageMedicos} totalPages={totalPagesMedicos} onPage={setPageMedicos} />
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </section>

        {editing && editForm && (
          <div className="vt-overlay" onClick={() => { if (!savingRef.current) { setEditing(false); setEditForm(null) } }} style={{ zIndex: 3000 }}>
            <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="vt-modal-head">
                <h3>Editar Médico (Cartera)</h3>
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
                    {(especialidadesLista ?? []).map(es => <option key={es.id} value={String(es.id)}>{es.nombre} ({es.codigo})</option>)}
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

        {(loadingEdit || saving) && (
          <div className="medicos-busy" role="status" aria-live="polite">
            <span className="medicos-busy-spinner" />
            <span>{saving ? 'Guardando…' : 'Cargando datos…'}</span>
          </div>
        )}

        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </AdminLayout>
  )
}

export default CarteraAdminView
