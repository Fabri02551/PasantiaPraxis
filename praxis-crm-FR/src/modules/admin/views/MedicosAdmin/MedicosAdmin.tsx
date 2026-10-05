import { useState, useEffect, useRef, useCallback } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import { Paginador } from '../../../core/components/Paginador/Paginador'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { MapPicker } from '../../components/MapPicker/MapPicker'
import { medicoService, type MedicoBE } from '../../../core/services/medico.service'
import { personaService } from '../../../core/services/persona.service'
import { especialidadService, type Especialidad } from '../../../core/services/especialidad.service'
import { ciudadService, type Ciudad } from '../../../core/services/ciudad.service'
import { ClasificacionPicker, MiniClasificacion } from '../../../core/components/ClasificacionPicker/ClasificacionPicker'
import { displayMedico } from '../../../core/utils/medicoPrefix'
import { normalizeUbicaciones, hospitalFromDireccion, type UbicacionMedico } from '../../../core/utils/medicoDireccion'
import { storage } from '../../../core/lib/storage'
import { Toast } from '../../../core/components/Toast/Toast'
import { SuccessModal } from '../../components/SuccessModal/SuccessModal'
import './MedicosAdmin.css'
import '../Visitadores/Visitadores.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow })

type Ubicacion = UbicacionMedico

type MedicoAdmin = {
  id: string
  nombre: string
  primerApellido: string
  segundoApellido: string
  sexo: string
  matricula: string
  especialidad: string
  hospital: string
  telefono: string
  email: string
  ci: string
  descripcion: string
  ciudad: string
  esParticular: boolean
  clasificacion: number
  ubicaciones: Ubicacion[]
}

const reqLabelStyle: React.CSSProperties = { color: '#8a9ab5', fontWeight: 400, fontSize: 10, opacity: 0.85, marginLeft: 4, textTransform: 'lowercase' }
const optLabelStyle: React.CSSProperties = { color: '#8a9ab5', fontWeight: 400, fontSize: 10, opacity: 0.75, marginLeft: 4, textTransform: 'lowercase' }

const mapBEList = async (list: MedicoBE[]): Promise<MedicoAdmin[]> => {
  const enriched = await Promise.all(
    list.map(async (b) => {
      let nombre = `Médico ${b.matricula || b.persona_id}`
      let primerApellido = ''
      let segundoApellido = ''
      let sexo = ''
      let email = ''
      let telefono = ''
      let ci = ''
      let ciudad = ''
      try {
        const p = await personaService.getById(b.persona_id)
        nombre = p.nombre || nombre
        primerApellido = p.primer_apellido || ''
        segundoApellido = p.segundo_apellido || ''
        sexo = p.sexo || ''
        email = p.correo || ''
        telefono = p.telefono || ''
        ci = p.ci || ''
        ciudad = p.ciudad_id ? String(p.ciudad_id) : ''
      } catch { /* sin persona, usa fallback */ }
      return {
        id: String(b.persona_id),
        nombre,
        primerApellido,
        segundoApellido,
        sexo,
        matricula: b.matricula || '',
        especialidad: String(b.especialidad_id ?? ''),
        hospital: hospitalFromDireccion(b.direccion),
        telefono,
        email,
        ci,
        descripcion: b.notas && typeof b.notas === 'object' && !Array.isArray(b.notas)
          ? Object.entries(b.notas as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join('\n')
          : (typeof b.notas === 'string' ? b.notas : ''),
        ciudad,
        esParticular: b.es_particular || false,
        clasificacion: b.clasificacion ?? 0,
        ubicaciones: normalizeUbicaciones(b.direccion),
      } as MedicoAdmin
    }),
  )
  return enriched
}

// La ubicación nueva de un médico nace "cerca de quien la está creando": la
// primera coordenada del picker se siembra con la posición guardada al
// iniciar sesión (storage.getUbicacion). Así el admin no arranca desde Quito
// a ciegas cuando está creando médicos en otra zona.
const coordsCercaDeMi = (): [number, number] | null => {
  const u = storage.getUbicacion()
  return u && Number.isFinite(u.latitud) && Number.isFinite(u.longitud) ? [u.latitud, u.longitud] : null
}

export const MedicosAdminView: React.FC<{ currentView: AdminView; onNavigate: (v: AdminView) => void; onLogout: () => void }> = ({ currentView, onNavigate, onLogout }) => {
  const [medicos, setMedicos] = useState<MedicoAdmin[]>([])
  const [search, setSearch] = useState('')
  const [committedQ, setCommittedQ] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [viewing, setViewing] = useState<MedicoAdmin | null>(null)
  const [editing, setEditing] = useState<MedicoAdmin | null>(null)
  const [editForm, setEditForm] = useState<MedicoAdmin | null>(null)
  const [deleting, setDeleting] = useState<MedicoAdmin | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<Omit<MedicoAdmin, 'id'>>(() => ({
    nombre: '', primerApellido: '', segundoApellido: '', sexo: '', matricula: '',
    especialidad: '', hospital: '', telefono: '', email: '', ci: '', descripcion: '',
    ciudad: '', esParticular: true, clasificacion: 1,
    ubicaciones: [{ id: 'u0', direccion: '', detalle: '', coords: coordsCercaDeMi() }],
  }))
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [ciudades, setCiudades] = useState<Ciudad[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  // Ref, no solo state: setSaving(true) no actualiza `saving` hasta el
  // siguiente render, así que dos clics rápidos aún pasarían la validación.
  const savingRef = useRef(false)
  const reqRef = useRef(0)
  const PAGE_SIZE = 20
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [createdName, setCreatedName] = useState<string | null>(null)
  const [createdDetail, setCreatedDetail] = useState<string | undefined>(undefined)
  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const load = useCallback(async (pageNum: number, q: string) => {
    const reqId = ++reqRef.current
    setLoading(true)
    try {
      const data = await medicoService.page({ page: pageNum, limit: PAGE_SIZE, q: q || undefined })
      const mapped = Array.isArray(data.items) ? await mapBEList(data.items) : []
      if (reqRef.current !== reqId) return
      const tp = Math.max(1, Math.ceil(data.total / PAGE_SIZE))
      setMedicos(mapped)
      setTotal(data.total)
      setTotalPages(tp)
      setPage(data.page)
    } catch (err) {
      if (reqRef.current !== reqId) return
      console.warn('[MedicosAdmin] API no disponible', err)
      setMedicos([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      if (reqRef.current === reqId) setLoading(false)
    }
  }, [])

  // Carga inicial + cada vez que cambia la búsqueda confirmada (vuelve a página 1).
  useEffect(() => {
    load(1, committedQ)
  }, [committedQ, load])

  // Debounce de la caja de búsqueda: espera a dejar de escribir (350 ms).
  useEffect(() => {
    const v = search.trim()
    const t = setTimeout(() => setCommittedQ(prev => (prev === v ? prev : v)), 350)
    return () => clearTimeout(t)
  }, [search])

  const goPage = (p: number) => {
    if (p >= 1 && p <= totalPages) load(p, committedQ)
  }

  useEffect(() => {
    especialidadService.list().then(data => setEspecialidades(Array.isArray(data) ? data : [])).catch(() => setEspecialidades([]))
  }, [])

  useEffect(() => {
    ciudadService.list().then(data => setCiudades(Array.isArray(data) ? data.filter(c => c.status !== false) : [])).catch(() => setCiudades([]))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (savingRef.current) return

    if (!form.nombre.trim() || !form.primerApellido.trim()) {
      showToast('Nombre y primer apellido son obligatorios', 'error')
      return
    }
    if (!form.matricula.trim()) {
      showToast('La matrícula es obligatoria', 'error')
      return
    }
    if (!form.especialidad) {
      showToast('La especialidad es obligatoria', 'error')
      return
    }
    if (!form.sexo) {
      showToast('El sexo es obligatorio', 'error')
      return
    }

    const ubicaciones = form.ubicaciones.filter(u => u.direccion.trim() || u.detalle.trim())
    const matricula = form.matricula.trim()
    savingRef.current = true
    setSaving(true)
    try {
      // Un solo POST: el backend inserta persona + medico en una transacción.
      // Si algo falla, no queda ninguna persona huérfana.
      const created = await medicoService.create({
        matricula,
        especialidad_id: Number(form.especialidad),
        persona: {
          nombre: form.nombre.trim(),
          primer_apellido: form.primerApellido.trim(),
          segundo_apellido: form.segundoApellido.trim(),
          sexo: form.sexo,
          correo: form.email.trim(),
          telefono: form.telefono.trim(),
          ci: form.ci.trim(),
          ciudad_id: form.ciudad ? Number(form.ciudad) : null,
        },
        es_particular: form.esParticular,
        clasificacion: form.clasificacion,
        direccion: ubicaciones,
        notas: form.descripcion.trim() ? { descripcion: form.descripcion.trim() } : undefined,
      })
      const [mapped] = await mapBEList([created])
      const row: MedicoAdmin = mapped ?? {
        id: String(created.persona_id),
        nombre: form.nombre.trim(),
        primerApellido: form.primerApellido.trim(),
        segundoApellido: form.segundoApellido.trim(),
        sexo: form.sexo,
        matricula,
        especialidad: form.especialidad,
        hospital: hospitalFromDireccion(ubicaciones),
        telefono: form.telefono.trim(),
        email: form.email.trim(),
        ci: form.ci.trim(),
        descripcion: form.descripcion.trim(),
        ciudad: form.ciudad,
        esParticular: form.esParticular,
        clasificacion: form.clasificacion,
        ubicaciones: ubicaciones.length > 0 ? ubicaciones : form.ubicaciones,
      }
      setSearch('')
      setCommittedQ('')
      load(1, '')
      showToast(`Médico registrado ✓ ${row.nombre} ${row.primerApellido} · ${matricula}`, 'success')
      setCreatedName(`${form.nombre.trim()} ${form.primerApellido.trim()}${form.segundoApellido.trim() ? ' ' + form.segundoApellido.trim() : ''}`.trim())
      setCreatedDetail(`Matrícula ${matricula}`)
      setForm({ nombre: '', primerApellido: '', segundoApellido: '', sexo: '', matricula: '', especialidad: '', hospital: '', telefono: '', email: '', ci: '', descripcion: '', ciudad: '', esParticular: true, clasificacion: 1, ubicaciones: [{ id: 'u0', direccion: '', detalle: '', coords: coordsCercaDeMi() }] })
      setShowCreate(false)
    } catch (err) {
      console.warn('[MedicosAdmin] create error', err)
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`No se guardó ✗ ${msg}`, 'error')
      setShowCreate(false)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm || savingRef.current) return
    const pid = Number(editForm.id)
    if (!Number.isFinite(pid)) {
      showToast('Id de persona inválido', 'error')
      return
    }
    const especialidadId = editForm.especialidad ? Number(editForm.especialidad) : null
    if (especialidadId === null || !Number.isFinite(especialidadId)) {
      showToast('La especialidad es obligatoria', 'error')
      return
    }
    const ubicaciones = editForm.ubicaciones.filter(u => u.direccion.trim() || u.detalle.trim())
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
      // direccion y notas son JSONB: se manda el objeto, no JSON.stringify.
      await medicoService.update(pid, {
        matricula: editForm.matricula.trim() || undefined,
        especialidad_id: especialidadId,
        es_particular: editForm.esParticular,
        clasificacion: editForm.clasificacion,
        direccion: ubicaciones,
        notas: editForm.descripcion.trim() ? { descripcion: editForm.descripcion.trim() } : undefined,
      })
      const row: MedicoAdmin = {
        ...editForm,
        matricula: editForm.matricula.trim() || editForm.matricula,
        hospital: hospitalFromDireccion(ubicaciones),
        ubicaciones: ubicaciones.length > 0 ? ubicaciones : editForm.ubicaciones,
      }
      load(page, committedQ)
      showToast(`Médico actualizado ✓ ${row.nombre} ${row.primerApellido}`, 'success')
      setEditing(null)
      setEditForm(null)
    } catch (err) {
      console.warn('[MedicosAdmin] update error', err)
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`No se actualizó ✗ ${msg}`, 'error')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      const pid = Number(deleting.id)
      if (!Number.isFinite(pid)) throw new Error('ID inválido')
      await medicoService.remove(pid)
      if (medicos.length === 1 && page > 1) load(page - 1, committedQ)
      else load(page, committedQ)
      showToast(`Médico eliminado ✓ ${deleting.nombre}`, 'success')
      setDeleting(null)
    } catch (err) {
      console.warn('[MedicosAdmin] delete error', err)
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`No se eliminó ✗ ${msg}`, 'error')
    }
  }

  const nombreCompleto = (m: MedicoAdmin) => `${m.nombre} ${m.primerApellido}${m.segundoApellido ? ' ' + m.segundoApellido : ''}`.trim()

  return (
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Médicos" searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar médico o especialidad...">
      <div className="pruebas-head">
        <div>
          <h2 className="pruebas-title">Médicos Registrados</h2>
          <p className="pruebas-sub">Gestiona profesionales médicos y sus ubicaciones asociadas.</p>
          {loading && <p style={{ fontSize: 11, color: '#2d9c9c', marginTop: 4 }}>Cargando...</p>}
        </div>
        <button className="btn-registrar" onClick={() => setShowCreate(true)}>+ Nuevo Médico</button>
      </div>

      <div className="pruebas-card">
        <div className="pruebas-table-wrap">
          <table className="pruebas-table">
            <thead>
              <tr>
                <th>Médico</th>
                <th>Especialidad</th>
                <th>Hospital</th>
                <th>Ubicaciones</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {medicos.map(m => (
                <tr key={m.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{displayMedico(m.sexo, nombreCompleto(m))}</span>
                      <span style={{ fontSize: 11, color: '#7e8aa6' }}>{m.email}{m.matricula ? ` · ${m.matricula}` : ''}</span>
                    </div>
                  </td>
                  <td><span className="medicos-espec">{m.especialidad ? ((especialidades ?? []).find(e => String(e.id) === m.especialidad)?.nombre || m.especialidad) : '—'}</span></td>
                  <td style={{ fontSize: 11.5 }}>{m.hospital || '—'}</td>
                  <td><span className="medicos-ubi-badge">{m.ubicaciones.length} {m.ubicaciones.length === 1 ? 'ubicación' : 'ubicaciones'}</span></td>
                  <td>
                    <div className="pruebas-actions">
                      <button className="vt-btn vt-btn--ver" onClick={() => setViewing(m)}>Ver</button>
                      <button className="vt-btn vt-btn--editar" onClick={() => { setEditing(m); setEditForm({ ...m, ubicaciones: [...m.ubicaciones] }) }}>Editar</button>
                      <button className="vt-btn vt-btn--eliminar" onClick={() => setDeleting(m)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {medicos.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#7e8aa6' }}>{total === 0 ? 'No hay médicos registrados' : 'Sin resultados.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px' }}>
          <span style={{ fontSize: 11, color: '#6b7a99', fontWeight: 600 }}>{total} {total === 1 ? 'médico' : 'médicos'}</span>
          <Paginador page={page} totalPages={totalPages} onPage={goPage} loading={loading} />
        </div>
      </div>

      {viewing && (
        <div className="vt-overlay" onClick={() => setViewing(null)}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal style={{ maxWidth: 560 }}>
            <div className="vt-modal-head"><h3>{displayMedico(viewing.sexo, nombreCompleto(viewing))}</h3><button className="vt-modal-close" onClick={() => setViewing(null)} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <div className="vt-view-body" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 12, color: '#2d9c9c', fontWeight: 600 }}>{viewing.especialidad ? ((especialidades ?? []).find(e => String(e.id) === viewing.especialidad)?.nombre || viewing.especialidad) : 'Sin especialidad'} · {viewing.hospital || 'Sin institución'}</span>
              <p style={{ fontSize: 12, color: '#1B2A4E', margin: 0 }}>{viewing.descripcion || 'Sin descripción'}</p>
              <div className="vt-view-grid">
                <span>Matrícula</span><strong>{viewing.matricula || '—'}</strong>
                <span>Sexo</span><strong>{viewing.sexo ? (viewing.sexo.toLowerCase().startsWith('f') ? 'Femenino' : viewing.sexo.toLowerCase().startsWith('m') ? 'Masculino' : viewing.sexo) : '—'}</strong>
                <span>CI</span><strong>{viewing.ci || '—'}</strong>
                <span>Ciudad</span><strong>{(ciudades ?? []).find(c => String(c.id) === viewing.ciudad)?.nombre || '—'}</strong>
                <span>Teléfono</span><strong>{viewing.telefono || '—'}</strong>
                <span>Email</span><strong>{viewing.email || '—'}</strong>
                <span>Tipo</span><strong>{viewing.esParticular ? 'Particular' : 'No particular'}</strong>
                <span>Clasificación</span><strong><MiniClasificacion valor={viewing.clasificacion} /></strong>
              </div>
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: '#1B2A4E', margin: '6px 0 8px' }}>Ubicaciones ({viewing.ubicaciones.length})</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {viewing.ubicaciones.map((u, idx) => (
                    <div key={u.id} style={{ border: '1px solid #e8ecf1', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E' }}>{idx + 1}. {u.direccion || u.hospital || 'Sin dirección'}</span>
                      {u.detalle && <span style={{ fontSize: 11, color: '#6b7a99' }}>{u.detalle}</span>}
                      {u.coords ? (
                        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e8ecf1' }}>
                          <MapContainer center={u.coords} zoom={14} scrollWheelZoom={false} zoomControl={false} style={{ height: 140, width: '100%' }}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
                            <Marker position={u.coords} />
                          </MapContainer>
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: '#7e8aa6', background: '#f8f9fb', borderRadius: 8, padding: 10, border: '1px dashed #dbe2ea' }}>
                          Sin coordenadas geocodificadas: esta ubicación no se dibuja en el mapa.
                        </div>
                      )}
                      {u.coords && (
                        <span style={{ fontSize: 11, color: '#2d9c9c', fontWeight: 600, textDecoration: 'none' }}>{u.coords[0].toFixed(4)}, {u.coords[1].toFixed(4)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #e8ecf1', background: '#fff' }}>
              <button className="vt-btn-submit" style={{ width: '100%', height: '40px', fontSize: '13px' }} onClick={() => setViewing(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="vt-overlay" onClick={() => { if (!savingRef.current) setShowCreate(false) }}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head"><h3>Nuevo Médico</h3><button className="vt-modal-close" onClick={() => setShowCreate(false)} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleCreate} className="vt-form">
              <label>Nombre <span style={reqLabelStyle}>* obligatorio</span><input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Juan" /></label>
              <label>Primer Apellido <span style={reqLabelStyle}>* obligatorio</span><input required value={form.primerApellido} onChange={e => setForm({ ...form, primerApellido: e.target.value })} placeholder="Ej. Pérez" /></label>
              <label>Segundo Apellido <span style={optLabelStyle}>(opcional)</span><input value={form.segundoApellido} onChange={e => setForm({ ...form, segundoApellido: e.target.value })} placeholder="Ej. López" /></label>
              <label>Sexo <span style={reqLabelStyle}>* obligatorio</span>
                <select required value={form.sexo} onChange={e => setForm({ ...form, sexo: e.target.value })}>
                  <option value="">Seleccione sexo</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                </select>
              </label>
              <label>Matrícula <span style={reqLabelStyle}>* obligatorio</span><input required value={form.matricula} onChange={e => setForm({ ...form, matricula: e.target.value })} placeholder="Ej. MED-12345" /></label>
              <label>Especialidad <span style={reqLabelStyle}>* obligatorio</span>
                <select required value={form.especialidad} onChange={e => setForm({ ...form, especialidad: e.target.value })}>
                  <option value="">Seleccione especialidad</option>
                  {(especialidades ?? []).map(es => <option key={es.id} value={String(es.id)}>{es.nombre} ({es.codigo})</option>)}
                </select>
              </label>
              <label>Teléfono <span style={optLabelStyle}>(opcional)</span><input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="Ej. 0999999999" /></label>
              <label>Correo / Email <span style={optLabelStyle}>(opcional)</span><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ejemplo@correo.com" /></label>
              <label>CI <span style={optLabelStyle}>(opcional)</span><input value={form.ci} onChange={e => setForm({ ...form, ci: e.target.value })} placeholder="Ej. 1712345678" /></label>
              <label>Ciudad <span style={optLabelStyle}>(opcional)</span>
                <select value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })}>
                  <option value="">Seleccione ciudad</option>
                  {(ciudades ?? []).map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#1B2A4E' }}>
                  <input type="checkbox" checked={form.esParticular} onChange={e => setForm({ ...form, esParticular: e.target.checked })} />
                  Particular
                </label>
                <div style={{ flex: 1.6 }}>
                  <ClasificacionPicker value={form.clasificacion} onChange={v => setForm({ ...form, clasificacion: v })} />
                </div>
              </div>
              <label>Descripción / Notas <span style={optLabelStyle}>(opcional)</span><textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Notas adicionales" /></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E' }}>Ubicaciones</span>
                {form.ubicaciones.map((u, idx) => (
                  <div key={u.id} style={{ border: '1px solid #e8ecf1', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: '#fcfcfd' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E' }}>Ubicación {idx + 1}</span>
                      <button type="button" className="vt-btn-cancel" onClick={() => setForm({ ...form, ubicaciones: form.ubicaciones.filter((_, i) => i !== idx) })} disabled={form.ubicaciones.length <= 1}>Quitar</button>
                    </div>
                    <label style={{ fontSize: 11, fontWeight: 600 }}>Dirección<input value={u.direccion} onChange={e => setForm({ ...form, ubicaciones: form.ubicaciones.map((x, i) => i === idx ? { ...x, direccion: e.target.value } : x) })} placeholder={`Dirección ${idx + 1}`} /></label>
                    <label style={{ fontSize: 11, fontWeight: 600 }}>Detalle de la ubicación<input value={u.detalle} onChange={e => setForm({ ...form, ubicaciones: form.ubicaciones.map((x, i) => i === idx ? { ...x, detalle: e.target.value } : x) })} placeholder="Ej. Consultorio 301, Torre Médica" /></label>
                    <MapPicker coords={u.coords} onChange={c => setForm({ ...form, ubicaciones: form.ubicaciones.map((x, i) => i === idx ? { ...x, coords: c } : x) })} height={140} />
                  </div>
                ))}
                <button type="button" className="vt-btn vt-btn--ver" onClick={() => setForm({ ...form, ubicaciones: [...form.ubicaciones, { id: `u${Date.now()}`, direccion: '', detalle: '', coords: coordsCercaDeMi() }] })} style={{ alignSelf: 'flex-start' }}>+ Agregar ubicación</button>
              </div>
              <div className="vt-form-actions"><button type="button" className="vt-btn-cancel" onClick={() => setShowCreate(false)} disabled={saving}>Cancelar</button><button type="submit" className="vt-btn-submit" disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</button></div>
            </form>
          </div>
        </div>
      )}

      {editing && editForm && (
        <div className="vt-overlay" onClick={() => { setEditing(null); setEditForm(null) }}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head"><h3>Editar Médico</h3><button className="vt-modal-close" onClick={() => { setEditing(null); setEditForm(null) }} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleEditSave} className="vt-form">
              <label>Nombre <span style={reqLabelStyle}>* obligatorio</span><input required value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} /></label>
              <label>Primer Apellido <span style={reqLabelStyle}>* obligatorio</span><input required value={editForm.primerApellido} onChange={e => setEditForm({ ...editForm, primerApellido: e.target.value })} /></label>
              <label>Segundo Apellido <span style={optLabelStyle}>(opcional)</span><input value={editForm.segundoApellido} onChange={e => setEditForm({ ...editForm, segundoApellido: e.target.value })} /></label>
              <label>Sexo <span style={reqLabelStyle}>* obligatorio</span>
                <select required value={editForm.sexo} onChange={e => setEditForm({ ...editForm, sexo: e.target.value })}>
                  <option value="">Seleccione sexo</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                </select>
              </label>
              <label>Matrícula <span style={reqLabelStyle}>* obligatorio</span><input required value={editForm.matricula} onChange={e => setEditForm({ ...editForm, matricula: e.target.value })} /></label>
              <label>Especialidad <span style={reqLabelStyle}>* obligatorio</span>
                <select required value={editForm.especialidad} onChange={e => setEditForm({ ...editForm, especialidad: e.target.value })}>
                  <option value="">Seleccione especialidad</option>
                  {(especialidades ?? []).map(es => <option key={es.id} value={String(es.id)}>{es.nombre} ({es.codigo})</option>)}
                </select>
              </label>
              <label>Teléfono <span style={optLabelStyle}>(opcional)</span><input value={editForm.telefono} onChange={e => setEditForm({ ...editForm, telefono: e.target.value })} /></label>
              <label>Email <span style={optLabelStyle}>(opcional)</span><input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></label>
              <label>CI <span style={optLabelStyle}>(opcional)</span><input value={editForm.ci} onChange={e => setEditForm({ ...editForm, ci: e.target.value })} /></label>
              <label>Ciudad <span style={optLabelStyle}>(opcional)</span>
                <select value={editForm.ciudad} onChange={e => setEditForm({ ...editForm, ciudad: e.target.value } as MedicoAdmin)}>
                  <option value="">Seleccione ciudad</option>
                  {(ciudades ?? []).map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#1B2A4E' }}>
                  <input type="checkbox" checked={editForm.esParticular} onChange={e => setEditForm({ ...editForm, esParticular: e.target.checked } as MedicoAdmin)} />
                  Particular
                </label>
                <div style={{ flex: 1.6 }}>
                  <ClasificacionPicker value={editForm.clasificacion} onChange={v => setEditForm({ ...editForm, clasificacion: v } as MedicoAdmin)} />
                </div>
              </div>
              <label>Descripción <span style={optLabelStyle}>(opcional)</span><textarea value={editForm.descripcion} onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} /></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E' }}>Ubicaciones</span>
                {editForm.ubicaciones.map((u, idx) => (
                  <div key={u.id} style={{ border: '1px solid #e8ecf1', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: '#fcfcfd' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E' }}>Ubicación {idx + 1}</span>
                      <button type="button" className="vt-btn-cancel" onClick={() => setEditForm({ ...editForm, ubicaciones: editForm.ubicaciones.filter((_, i) => i !== idx) } as MedicoAdmin)} disabled={editForm.ubicaciones.length <= 1}>Quitar</button>
                    </div>
                    <label style={{ fontSize: 11, fontWeight: 600 }}>Dirección<input value={u.direccion} onChange={e => setEditForm({ ...editForm, ubicaciones: editForm.ubicaciones.map((x, i) => i === idx ? { ...x, direccion: e.target.value } : x) } as MedicoAdmin)} placeholder={`Dirección ${idx + 1}`} /></label>
                    <label style={{ fontSize: 11, fontWeight: 600 }}>Detalle<input value={u.detalle} onChange={e => setEditForm({ ...editForm, ubicaciones: editForm.ubicaciones.map((x, i) => i === idx ? { ...x, detalle: e.target.value } : x) } as MedicoAdmin)} placeholder="Ej. Consultorio 301" /></label>
                    <MapPicker coords={u.coords} onChange={c => setEditForm({ ...editForm, ubicaciones: editForm.ubicaciones.map((x, i) => i === idx ? { ...x, coords: c } : x) } as MedicoAdmin)} height={140} />
                  </div>
                ))}
                <button type="button" className="vt-btn vt-btn--ver" onClick={() => setEditForm({ ...editForm, ubicaciones: [...editForm.ubicaciones, { id: `u${Date.now()}`, direccion: '', detalle: '', coords: coordsCercaDeMi() }] } as MedicoAdmin)} style={{ alignSelf: 'flex-start' }}>+ Agregar ubicación</button>
              </div>
              <div className="vt-form-actions"><button type="button" className="vt-btn-cancel" onClick={() => { setEditing(null); setEditForm(null) }} disabled={saving}>Cancelar</button><button type="submit" className="vt-btn-submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar Cambios'}</button></div>
            </form>
          </div>
        </div>
      )}

      {deleting && (
        <div className="vt-overlay" onClick={() => setDeleting(null)}>
          <div className="vt-modal vt-modal--sm" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head"><h3>Confirmar Eliminación</h3><button className="vt-modal-close" onClick={() => setDeleting(null)} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <div className="vt-delete-body">
              <div className="vt-delete-icon--minimal"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#8a9ab5" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="M12 8v6" /><circle cx="12" cy="16" r="0.8" fill="#8a9ab5" stroke="none" /></svg></div>
              <p>¿Eliminar <strong>{displayMedico(deleting.sexo, nombreCompleto(deleting))}</strong>?</p>
              <p className="vt-delete-hint">Esta acción eliminará el registro de forma permanente.</p>
              <div className="vt-form-actions"><button className="vt-btn-cancel" onClick={() => setDeleting(null)}>Cancelar</button><button className="vt-btn vt-btn--eliminar" onClick={handleDelete}>Eliminar</button></div>
            </div>
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

      <SuccessModal
        open={createdName !== null}
        onClose={() => { setCreatedName(null); setCreatedDetail(undefined) }}
        kind="medico"
        name={createdName ?? ''}
        detail={createdDetail}
      />
    </AdminLayout>
  )
}
