import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
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
import { SuccessModal } from '../../components/SuccessModal/SuccessModal'
import { institucionService, type InstitucionBE } from '../../../core/services/institucion.service'
import { visitadorService, type VisitadorBE } from '../../../core/services/visitador.service'
import { ciudadService, type Ciudad } from '../../../core/services/ciudad.service'
import { ClasificacionPicker, MiniClasificacion } from '../../../core/components/ClasificacionPicker/ClasificacionPicker'
import { ENV, API_LABEL } from '../../../core/config/env'
import { normalizeUbicaciones, type UbicacionMedico } from '../../../core/utils/medicoDireccion'
import { storage } from '../../../core/lib/storage'
import { Toast } from '../../../core/components/Toast/Toast'
import '../MedicosAdmin/MedicosAdmin.css'
import './Instituciones.css'
import '../Visitadores/Visitadores.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow })

type Ubicacion = UbicacionMedico

type InstitucionView = {
  id: number
  nombre: string
  razonSocial: string
  nit: string
  tipoContrato: string
  telefono: string
  correo: string
  visitadorId: number | null
  esParticular: boolean
  clasificacion: number
  ciudad: string
  ubicaciones: Ubicacion[]
}

const reqLabelStyle: React.CSSProperties = { color: '#8a9ab5', fontWeight: 400, fontSize: 10, opacity: 0.85, marginLeft: 4, textTransform: 'lowercase' }
const optLabelStyle: React.CSSProperties = { color: '#8a9ab5', fontWeight: 400, fontSize: 10, opacity: 0.75, marginLeft: 4, textTransform: 'lowercase' }

// La ubicación nueva de una institución nace "cerca de quien la está creando",
// igual que en el alta de médicos: la primera coordenada se siembra con la
// posición guardada al iniciar sesión (storage.getUbicacion).
const coordsCercaDeMi = (): [number, number] | null => {
  const u = storage.getUbicacion()
  return u && Number.isFinite(u.latitud) && Number.isFinite(u.longitud) ? [u.latitud, u.longitud] : null
}

const mapBE = (b: InstitucionBE): InstitucionView => ({
  id: b.id,
  nombre: b.nombre,
  razonSocial: b.razon_social || '',
  nit: b.nit || '',
  tipoContrato: b.tipo_contrato || '',
  telefono: b.telefono || '',
  correo: b.correo || '',
  visitadorId: b.visitador_id ?? null,
  esParticular: b.es_particular || false,
  clasificacion: b.clasificacion ?? 0,
  ciudad: b.ciudad_id ? String(b.ciudad_id) : '',
  ubicaciones: normalizeUbicaciones(b.direccion),
})

export const InstitucionesView: React.FC<{ currentView: AdminView; onNavigate: (v: AdminView) => void; onLogout: () => void }> = ({ currentView, onNavigate, onLogout }) => {
  const [instituciones, setInstituciones] = useState<InstitucionView[]>([])
  const [visitadores, setVisitadores] = useState<VisitadorBE[]>([])
  const [search, setSearch] = useState('')
  const [committedQ, setCommittedQ] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [viewing, setViewing] = useState<InstitucionView | null>(null)
  const [editing, setEditing] = useState<InstitucionView | null>(null)
  const [editForm, setEditForm] = useState<InstitucionView | null>(null)
  const [deleting, setDeleting] = useState<InstitucionView | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<Omit<InstitucionView, 'id'>>(() => ({
    nombre: '', razonSocial: '', nit: '', tipoContrato: '', telefono: '', correo: '',
    visitadorId: null, esParticular: true, clasificacion: 1, ciudad: '',
    ubicaciones: [{ id: 'u0', direccion: '', detalle: '', coords: coordsCercaDeMi() }],
  }))
  const [ciudades, setCiudades] = useState<Ciudad[]>([])
  const [createdName, setCreatedName] = useState<string | null>(null)
  const [apiStatus, setApiStatus] = useState(`API: ${API_LABEL}`)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const reqRef = useRef(0)
  const PAGE_SIZE = 20
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)
  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const load = useCallback(async (pageNum: number, q: string) => {
    const reqId = ++reqRef.current
    setLoading(true)
    try {
      const data = await institucionService.page({ page: pageNum, limit: PAGE_SIZE, q: q || undefined })
      if (reqRef.current !== reqId) return
      const tp = Math.max(1, Math.ceil(data.total / PAGE_SIZE))
      setInstituciones(data.items.map(mapBE))
      setTotal(data.total)
      setTotalPages(tp)
      setPage(data.page)
      setApiStatus(`Conectado a ${API_LABEL} — ${data.total} instituciones (página ${data.page} de ${tp})`)
    } catch (err) {
      if (reqRef.current !== reqId) return
      console.warn('[Instituciones] API no disponible', err)
      setInstituciones([])
      setTotal(0)
      setTotalPages(1)
      setApiStatus(`Error: sin conexión a ${API_LABEL} — ${err instanceof Error ? err.message : 'no se pudo cargar instituciones'}`)
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
    visitadorService
      .list()
      .then((data) => setVisitadores(Array.isArray(data) ? data : []))
      .catch(() => setVisitadores([]))
  }, [])

  useEffect(() => {
    ciudadService.list().then(data => setCiudades(Array.isArray(data) ? data.filter(c => c.status !== false) : [])).catch(() => setCiudades([]))
  }, [])

  const visitadorDe = (id: number | null): VisitadorBE | undefined =>
    id == null ? undefined : visitadores.find((v) => v.persona_id === id)

  const visitadorNombres = useMemo(() => {
    const m = new Map<number, string>()
    visitadores.forEach((v) => m.set(v.persona_id, `${v.nombre} ${v.primer_apellido}`.trim()))
    return m
  }, [visitadores])

  const resetForm = () =>
    setForm({
      nombre: '', razonSocial: '', nit: '', tipoContrato: '', telefono: '', correo: '',
      visitadorId: null, esParticular: true, clasificacion: 1, ciudad: '',
      ubicaciones: [{ id: 'u0', direccion: '', detalle: '', coords: coordsCercaDeMi() }],
    })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (savingRef.current) return
    if (!form.nombre.trim()) {
      showToast('El nombre es obligatorio', 'error')
      return
    }
    if (!form.nit.trim()) {
      showToast('El NIT es obligatorio', 'error')
      return
    }
    const ubicaciones = form.ubicaciones.filter((u) => u.direccion.trim() || u.detalle.trim())
    savingRef.current = true
    setSaving(true)
    try {
      // direccion es JSONB: se manda el array parseado, no JSON.stringify.
      const created = await institucionService.create({
        nombre: form.nombre.trim(),
        razon_social: form.razonSocial.trim(),
        nit: form.nit.trim(),
        tipo_contrato: form.tipoContrato.trim(),
        telefono: form.telefono.trim(),
        correo: form.correo.trim(),
        visitador_id: form.visitadorId,
        es_particular: form.esParticular,
        clasificacion: form.clasificacion,
        ciudad_id: form.ciudad ? Number(form.ciudad) : null,
        direccion: ubicaciones,
      })
      const row = mapBE(created)
      setSearch('')
      setCommittedQ('')
      load(1, '')
      setApiStatus(`Creado en API: ${form.nombre}`)
      showToast(`Institución registrada ✓ ${row.nombre}`, 'success')
      setCreatedName(form.nombre.trim())
      resetForm()
      setShowCreate(false)
    } catch (err) {
      console.warn('[Instituciones] create error', err)
      const msg = err instanceof Error ? err.message : String(err)
      setApiStatus(`Error al crear institución: ${msg}`)
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
    if (!Number.isFinite(editForm.id)) {
      showToast('Id de institución inválido', 'error')
      return
    }
    if (!editForm.nit.trim()) {
      showToast('El NIT es obligatorio', 'error')
      return
    }
    const ubicaciones = editForm.ubicaciones.filter((u) => u.direccion.trim() || u.detalle.trim())
    savingRef.current = true
    setSaving(true)
    try {
      await institucionService.update(editForm.id, {
        nombre: editForm.nombre.trim() || undefined,
        razon_social: editForm.razonSocial.trim() || undefined,
        nit: editForm.nit.trim() || undefined,
        tipo_contrato: editForm.tipoContrato.trim() || undefined,
        telefono: editForm.telefono.trim() || undefined,
        correo: editForm.correo.trim() || undefined,
        visitador_id: editForm.visitadorId,
        es_particular: editForm.esParticular,
        clasificacion: editForm.clasificacion,
        ciudad_id: editForm.ciudad ? Number(editForm.ciudad) : null,
        direccion: ubicaciones,
      })
      const row: InstitucionView = {
        ...editForm,
        nombre: editForm.nombre.trim() || editForm.nombre,
        ubicaciones: ubicaciones.length > 0 ? ubicaciones : editForm.ubicaciones,
      }
      load(page, committedQ)
      setApiStatus(`Actualizado en API: ${row.nombre}`)
      showToast(`Institución actualizada ✓ ${row.nombre}`, 'success')
      setEditing(null)
      setEditForm(null)
    } catch (err) {
      console.warn('[Instituciones] update error', err)
      const msg = err instanceof Error ? err.message : String(err)
      setApiStatus(`Error al actualizar: ${msg}`)
      showToast(`No se actualizó ✗ ${msg}`, 'error')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await institucionService.remove(deleting.id)
      if (instituciones.length === 1 && page > 1) load(page - 1, committedQ)
      else load(page, committedQ)
      setApiStatus(`Eliminado en API: ${deleting.nombre}`)
      showToast(`Institución eliminada ✓ ${deleting.nombre}`, 'success')
      setDeleting(null)
    } catch (err) {
      console.warn('[Instituciones] delete error', err)
      const msg = err instanceof Error ? err.message : String(err)
      setApiStatus(`Error al eliminar: ${msg}`)
      showToast(`No se eliminó ✗ ${msg}`, 'error')
    }
  }

  return (
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Instituciones" searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar institución, NIT o visitador...">
      <div className="pruebas-head">
        <div>
          <h2 className="pruebas-title">Instituciones Registradas</h2>
          <p className="pruebas-sub">Gestiona clínicas, hospitales y sedes asignadas a visitadores.</p>
          <p style={{ fontSize: 11, color: loading ? '#2d9c9c' : '#6b7a99', marginTop: 4 }}>{loading ? 'Cargando...' : apiStatus}</p>
        </div>
        <button className="btn-registrar" onClick={() => setShowCreate(true)}>+ Nueva Institución</button>
      </div>

      <div className="pruebas-card">
        <div className="pruebas-table-wrap">
          <table className="pruebas-table">
            <thead>
              <tr>
                <th>Institución</th>
                <th>Visitador</th>
                <th>Dirección</th>
                <th>Ubicaciones</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {instituciones.map((i) => {
                const v = visitadorDe(i.visitadorId)
                return (
                  <tr key={i.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: 12 }}>{i.nombre}</span>
                        <span style={{ fontSize: 11, color: '#7e8aa6' }}>{i.correo}{i.nit ? ` · NIT ${i.nit}` : ''}</span>
                      </div>
                    </td>
                    <td>
                      {v ? (
                        <span style={{ fontSize: 11.5, fontWeight: 600, background: '#eef2ff', color: '#4338ca', padding: '3px 7px', borderRadius: 10 }}>{`${v.nombre} ${v.primer_apellido}`.trim()}</span>
                      ) : (
                        <span style={{ fontSize: 11.5, color: '#a0aec0' }}>Sin asignar</span>
                      )}
                    </td>
                    <td style={{ fontSize: 11.5, color: '#6b7a99', maxWidth: 180 }}>
                      <span style={{ display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                        {i.ubicaciones[0]?.direccion || 'Sin dirección registrada'}
                      </span>
                    </td>
                    <td><span className="medicos-ubi-badge">{i.ubicaciones.length} {i.ubicaciones.length === 1 ? 'ubicación' : 'ubicaciones'}</span></td>
                    <td>
                      <div className="pruebas-actions">
                        <button className="vt-btn vt-btn--ver" onClick={() => setViewing(i)}>Ver</button>
                        <button className="vt-btn vt-btn--editar" onClick={() => { setEditing(i); setEditForm({ ...i, ubicaciones: [...i.ubicaciones] }) }}>Editar</button>
                        <button className="vt-btn vt-btn--eliminar" onClick={() => setDeleting(i)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {instituciones.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#7e8aa6' }}>{total === 0 ? 'No hay instituciones registradas' : 'Sin resultados.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px' }}>
          <span style={{ fontSize: 11, color: '#6b7a99', fontWeight: 600 }}>{total} {total === 1 ? 'institución' : 'instituciones'}</span>
          <Paginador page={page} totalPages={totalPages} onPage={goPage} loading={loading} />
        </div>
      </div>

      {viewing && (
        <div className="vt-overlay" onClick={() => setViewing(null)}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal style={{ maxWidth: 560 }}>
            <div className="vt-modal-head"><h3>{viewing.nombre}</h3><button className="vt-modal-close" onClick={() => setViewing(null)} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <div className="vt-view-body" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 12, color: '#2d9c9c', fontWeight: 600 }}>
                Visitador asignado: {visitadorNombres.get(viewing.visitadorId ?? -1) ?? '—'}{viewing.tipoContrato ? ` · Contrato: ${viewing.tipoContrato}` : ''}
              </span>
              <div className="vt-view-grid">
                <span>Razón social</span><strong>{viewing.razonSocial || '—'}</strong>
                <span>NIT</span><strong>{viewing.nit || '—'}</strong>
                <span>Ciudad</span><strong>{(ciudades ?? []).find(c => String(c.id) === viewing.ciudad)?.nombre || '—'}</strong>
                <span>Tipo</span><strong>{viewing.esParticular ? 'Particular' : 'No particular'}</strong>
                <span>Clasificación</span><strong><MiniClasificacion valor={viewing.clasificacion} /></strong>
                <span>Teléfono</span><strong>{viewing.telefono || '—'}</strong>
                <span>Email</span><strong>{viewing.correo || '—'}</strong>
              </div>
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: '#1B2A4E', margin: '6px 0 8px' }}>Ubicaciones ({viewing.ubicaciones.length})</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {viewing.ubicaciones.map((u, idx) => (
                    <div key={u.id} style={{ border: '1px solid #e8ecf1', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E' }}>{idx + 1}. {u.direccion || 'Sin dirección'}</span>
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
            <div className="vt-modal-head"><h3>Nueva Institución</h3><button className="vt-modal-close" onClick={() => setShowCreate(false)} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleCreate} className="vt-form">
              <label>Nombre <span style={reqLabelStyle}>* obligatorio</span><input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Clínica Central" /></label>
              <label>Razón Social <span style={optLabelStyle}>(opcional)</span><input value={form.razonSocial} onChange={e => setForm({ ...form, razonSocial: e.target.value })} placeholder="Ej. Clínica Central S.A." /></label>
              <label>NIT <span style={reqLabelStyle}>* obligatorio</span><input required value={form.nit} onChange={e => setForm({ ...form, nit: e.target.value })} placeholder="Ej. 1791234567001" /></label>
              <label>Tipo de Contrato <span style={optLabelStyle}>(opcional)</span><input value={form.tipoContrato} onChange={e => setForm({ ...form, tipoContrato: e.target.value })} placeholder="Ej. convenio, particular…" /></label>
              <label>Ciudad <span style={optLabelStyle}>(opcional)</span>
                <select value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })}>
                  <option value="">Seleccione ciudad</option>
                  {(ciudades ?? []).map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
                </select>
              </label>
              <label>Visitador Asignado <span style={optLabelStyle}>(opcional)</span>
                <select value={form.visitadorId ?? ''} onChange={e => setForm({ ...form, visitadorId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Sin asignar</option>
                  {visitadores.map(v => <option key={v.persona_id} value={String(v.persona_id)}>{`${v.nombre} ${v.primer_apellido}`.trim()}</option>)}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E' }}>Ubicaciones</span>
                {form.ubicaciones.map((u, idx) => (
                  <div key={u.id} style={{ border: '1px solid #e8ecf1', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: '#fcfcfd' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E' }}>Ubicación {idx + 1}</span>
                      <button type="button" className="vt-btn-cancel" onClick={() => setForm({ ...form, ubicaciones: form.ubicaciones.filter((_, i) => i !== idx) })} disabled={form.ubicaciones.length <= 1}>Quitar</button>
                    </div>
                    <label style={{ fontSize: 11, fontWeight: 600 }}>Dirección<input value={u.direccion} onChange={e => setForm({ ...form, ubicaciones: form.ubicaciones.map((x, i) => i === idx ? { ...x, direccion: e.target.value } : x) })} placeholder={`Dirección ${idx + 1}`} /></label>
                    <label style={{ fontSize: 11, fontWeight: 600 }}>Detalle de la ubicación<input value={u.detalle} onChange={e => setForm({ ...form, ubicaciones: form.ubicaciones.map((x, i) => i === idx ? { ...x, detalle: e.target.value } : x) })} placeholder="Ej. Torre A, 3er piso" /></label>
                    <MapPicker coords={u.coords} onChange={c => setForm({ ...form, ubicaciones: form.ubicaciones.map((x, i) => i === idx ? { ...x, coords: c } : x) })} height={140} />
                  </div>
                ))}
                <button type="button" className="vt-btn vt-btn--ver" onClick={() => setForm({ ...form, ubicaciones: [...form.ubicaciones, { id: `u${Date.now()}`, direccion: '', detalle: '', coords: coordsCercaDeMi() }] })} style={{ alignSelf: 'flex-start' }}>+ Agregar ubicación</button>
              </div>
              <label>Teléfono <span style={optLabelStyle}>(opcional)</span><input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="Ej. 02 2555 0000" /></label>
              <label>Correo / Email <span style={optLabelStyle}>(opcional)</span><input type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} placeholder="ejemplo@clinica.com" /></label>
              <div className="vt-form-actions"><button type="button" className="vt-btn-cancel" onClick={() => setShowCreate(false)} disabled={saving}>Cancelar</button><button type="submit" className="vt-btn-submit" disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</button></div>
            </form>
          </div>
        </div>
      )}

      {editing && editForm && (
        <div className="vt-overlay" onClick={() => { setEditing(null); setEditForm(null) }}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head"><h3>Editar Institución</h3><button className="vt-modal-close" onClick={() => { setEditing(null); setEditForm(null) }} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleEditSave} className="vt-form">
              <label>Nombre <span style={reqLabelStyle}>* obligatorio</span><input required value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value } as InstitucionView)} /></label>
              <label>Razón Social <span style={optLabelStyle}>(opcional)</span><input value={editForm.razonSocial} onChange={e => setEditForm({ ...editForm, razonSocial: e.target.value } as InstitucionView)} /></label>
              <label>NIT <span style={reqLabelStyle}>* obligatorio</span><input required value={editForm.nit} onChange={e => setEditForm({ ...editForm, nit: e.target.value } as InstitucionView)} /></label>
              <label>Tipo de Contrato <span style={optLabelStyle}>(opcional)</span><input value={editForm.tipoContrato} onChange={e => setEditForm({ ...editForm, tipoContrato: e.target.value } as InstitucionView)} /></label>
              <label>Ciudad <span style={optLabelStyle}>(opcional)</span>
                <select value={editForm.ciudad} onChange={e => setEditForm({ ...editForm, ciudad: e.target.value } as InstitucionView)}>
                  <option value="">Seleccione ciudad</option>
                  {(ciudades ?? []).map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
                </select>
              </label>
              <label>Visitador Asignado <span style={optLabelStyle}>(opcional)</span>
                <select value={editForm.visitadorId ?? ''} onChange={e => setEditForm({ ...editForm, visitadorId: e.target.value ? Number(e.target.value) : null } as InstitucionView)}>
                  <option value="">Sin asignar</option>
                  {visitadores.map(v => <option key={v.persona_id} value={String(v.persona_id)}>{`${v.nombre} ${v.primer_apellido}`.trim()}</option>)}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#1B2A4E' }}>
                  <input type="checkbox" checked={editForm.esParticular} onChange={e => setEditForm({ ...editForm, esParticular: e.target.checked } as InstitucionView)} />
                  Particular
                </label>
                <div style={{ flex: 1.6 }}>
                  <ClasificacionPicker value={editForm.clasificacion} onChange={v => setEditForm({ ...editForm, clasificacion: v } as InstitucionView)} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E' }}>Ubicaciones</span>
                {editForm.ubicaciones.map((u, idx) => (
                  <div key={u.id} style={{ border: '1px solid #e8ecf1', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: '#fcfcfd' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E' }}>Ubicación {idx + 1}</span>
                      <button type="button" className="vt-btn-cancel" onClick={() => setEditForm({ ...editForm, ubicaciones: editForm.ubicaciones.filter((_, i) => i !== idx) } as InstitucionView)} disabled={editForm.ubicaciones.length <= 1}>Quitar</button>
                    </div>
                    <label style={{ fontSize: 11, fontWeight: 600 }}>Dirección<input value={u.direccion} onChange={e => setEditForm({ ...editForm, ubicaciones: editForm.ubicaciones.map((x, i) => i === idx ? { ...x, direccion: e.target.value } : x) } as InstitucionView)} /></label>
                    <label style={{ fontSize: 11, fontWeight: 600 }}>Detalle<input value={u.detalle} onChange={e => setEditForm({ ...editForm, ubicaciones: editForm.ubicaciones.map((x, i) => i === idx ? { ...x, detalle: e.target.value } : x) } as InstitucionView)} /></label>
                    <MapPicker coords={u.coords} onChange={c => setEditForm({ ...editForm, ubicaciones: editForm.ubicaciones.map((x, i) => i === idx ? { ...x, coords: c } : x) } as InstitucionView)} height={140} />
                  </div>
                ))}
                <button type="button" className="vt-btn vt-btn--ver" onClick={() => setEditForm({ ...editForm, ubicaciones: [...editForm.ubicaciones, { id: `u${Date.now()}`, direccion: '', detalle: '', coords: coordsCercaDeMi() }] } as InstitucionView)} style={{ alignSelf: 'flex-start' }}>+ Agregar ubicación</button>
              </div>
              <label>Teléfono <span style={optLabelStyle}>(opcional)</span><input value={editForm.telefono} onChange={e => setEditForm({ ...editForm, telefono: e.target.value } as InstitucionView)} /></label>
              <label>Email <span style={optLabelStyle}>(opcional)</span><input type="email" value={editForm.correo} onChange={e => setEditForm({ ...editForm, correo: e.target.value } as InstitucionView)} /></label>
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
              <p>¿Eliminar <strong>{deleting.nombre}</strong>?</p>
              <p className="vt-delete-hint">Esta acción eliminará el registro en la base de datos ({ENV.API_URL}).</p>
              <div className="vt-form-actions"><button className="vt-btn-cancel" onClick={() => setDeleting(null)}>Cancelar</button><button className="vt-btn vt-btn--eliminar" onClick={handleDelete}>Eliminar</button></div>
            </div>
          </div>
        </div>
      )}

      {saving && (
        <div className="medicos-busy" role="status" aria-live="polite">
          <span className="medicos-busy-spinner" />
          <span>Guardando en la base de datos…</span>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <SuccessModal open={createdName !== null} onClose={() => setCreatedName(null)} kind="institucion" name={createdName ?? ''} />
    </AdminLayout>
  )
}