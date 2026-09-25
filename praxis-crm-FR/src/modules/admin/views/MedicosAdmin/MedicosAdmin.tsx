import { useState, useMemo, useEffect } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
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
import { ENV } from '../../../core/config/env'
import { displayMedico } from '../../../core/utils/medicoPrefix'
import './MedicosAdmin.css'
import '../Visitadores/Visitadores.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow })

type Ubicacion = { id: string; direccion: string; detalle: string; coords: [number, number]; hospital?: string }

type MedicoAdmin = {
  id: string
  nombre: string
  primerApellido: string
  segundoApellido: string
  sexo: string
  codigo: string
  especialidad: string
  hospital: string
  telefono: string
  email: string
  ci: string
  descripcion: string
  ubicaciones: Ubicacion[]
}

const reqLabelStyle: React.CSSProperties = { color: '#8a9ab5', fontWeight: 400, fontSize: 10, opacity: 0.85, marginLeft: 4, textTransform: 'lowercase' }
const optLabelStyle: React.CSSProperties = { color: '#8a9ab5', fontWeight: 400, fontSize: 10, opacity: 0.75, marginLeft: 4, textTransform: 'lowercase' }

export const MedicosAdminView: React.FC<{ currentView: AdminView; onNavigate: (v: AdminView) => void; onLogout: () => void }> = ({ currentView, onNavigate, onLogout }) => {
  const [medicos, setMedicos] = useState<MedicoAdmin[]>([])
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<MedicoAdmin | null>(null)
  const [editing, setEditing] = useState<MedicoAdmin | null>(null)
  const [editForm, setEditForm] = useState<MedicoAdmin | null>(null)
  const [deleting, setDeleting] = useState<MedicoAdmin | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<Omit<MedicoAdmin, 'id'>>({
    nombre: '', primerApellido: '', segundoApellido: '', sexo: '', codigo: '',
    especialidad: '', hospital: '', telefono: '', email: '', ci: '', descripcion: '',
    ubicaciones: [{ id: 'u0', direccion: '', detalle: '', coords: [-0.1807, -78.4678] }],
  })
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [apiStatus, setApiStatus] = useState(`API: ${ENV.API_URL}`)
  const [loading, setLoading] = useState(false)

  const parseUbicaciones = (raw: unknown, fallbackHospital?: string): Ubicacion[] => {
    if (!raw) return fallbackHospital ? [{ id: 'u0', direccion: fallbackHospital, detalle: '', coords: [-0.1807, -78.4678] }] : []
    try {
      const arr = typeof raw === 'string' ? JSON.parse(raw as string) : raw
      if (Array.isArray(arr)) {
        return (arr as unknown[]).map((u, i) => {
          const o = u as Record<string, unknown>
          const coords = Array.isArray(o.coords) && (o.coords as unknown[]).length === 2 ? (o.coords as [number, number]) : ([-0.1807, -78.4678] as [number, number])
          return {
            id: typeof o.id === 'string' ? o.id : `u${i}`,
            direccion: typeof o.direccion === 'string' ? o.direccion : (typeof o.hospital === 'string' ? o.hospital : ''),
            detalle: typeof o.detalle === 'string' ? o.detalle : '',
            coords,
            hospital: typeof o.hospital === 'string' ? o.hospital : undefined,
          }
        })
      }
    } catch { /* ignore parse error */ }
    if (typeof raw === 'string' && (raw as string).trim()) return [{ id: 'u0', direccion: raw as string, detalle: '', coords: [-0.1807, -78.4678] }]
    return fallbackHospital ? [{ id: 'u0', direccion: fallbackHospital, detalle: '', coords: [-0.1807, -78.4678] }] : []
  }

  const mapBEList = async (list: MedicoBE[]): Promise<MedicoAdmin[]> => {
    const enriched = await Promise.all(
      list.map(async (b) => {
        let nombre = `Médico ${b.codigo || b.persona_id}`
        let primerApellido = ''
        let segundoApellido = ''
        let sexo = ''
        let email = ''
        let telefono = ''
        let ci = ''
        try {
          const p = await personaService.getById(b.persona_id)
          nombre = p.nombre || nombre
          primerApellido = p.primer_apellido || ''
          segundoApellido = p.segundo_apellido || ''
          sexo = p.sexo || ''
          email = p.correo || ''
          telefono = p.telefono || ''
          ci = p.ci || ''
        } catch { /* sin persona, usa fallback */ }
        return {
          id: String(b.persona_id),
          nombre,
          primerApellido,
          segundoApellido,
          sexo,
          codigo: b.codigo || '',
          especialidad: String(b.especialidad_id ?? ''),
          hospital: b.institucion || '',
          telefono,
          email,
          ci,
          descripcion: typeof b.notas === 'string' ? b.notas : '',
          ubicaciones: parseUbicaciones(b.direccion, b.institucion),
        } as MedicoAdmin
      }),
    )
    return enriched
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    medicoService
      .list()
      .then(async (data) => {
        if (cancelled) return
        if (Array.isArray(data) && data.length > 0) {
          const mapped = await mapBEList(data)
          if (cancelled) return
          setMedicos(mapped)
          setApiStatus(`Conectado a ${ENV.API_URL} — ${data.length} médicos desde /api/medicos`)
        } else {
          setMedicos([])
          setApiStatus(`Conectado a ${ENV.API_URL} — sin datos`)
        }
      })
      .catch((err) => {
        console.warn('[MedicosAdmin] API no disponible', err)
        if (cancelled) return
        setMedicos([])
        setApiStatus(`Error: sin conexión a ${ENV.API_URL} — ${err instanceof Error ? err.message : 'no se pudo cargar médicos'}`)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    especialidadService.list().then(data => setEspecialidades(Array.isArray(data) ? data : [])).catch(() => setEspecialidades([]))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return medicos
    return medicos.filter(m => displayMedico(m.sexo, `${m.nombre} ${m.primerApellido}`).toLowerCase().includes(q) || m.especialidad.toLowerCase().includes(q) || m.hospital.toLowerCase().includes(q))
  }, [medicos, search])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim() || !form.primerApellido.trim()) return
    const direccionPayload = form.ubicaciones[0] ? JSON.stringify(form.ubicaciones) : undefined
    try {
      const persona = await personaService.create({
        nombre: form.nombre.trim(),
        primer_apellido: form.primerApellido.trim(),
        segundo_apellido: form.segundoApellido.trim() || null,
        sexo: form.sexo || '',
        correo: form.email?.trim() || '',
        telefono: form.telefono?.trim() || '',
        ci: form.ci?.trim() || '',
      } as unknown as Omit<import('../../../core/services/persona.service').Persona, 'id' | 'status' | 'created_at'>)
      const pid = (persona as unknown as { id: number }).id
      const codigo = form.codigo.trim()
      const especialidadId = form.especialidad ? Number(form.especialidad) : undefined
      const created = await medicoService.create({
        persona_id: pid,
        codigo,
        especialidad_id: Number.isFinite(especialidadId as number) ? especialidadId : undefined,
        direccion: direccionPayload ? (JSON.parse(direccionPayload) as unknown) : undefined,
      } as never)
      const mappedList = await mapBEList([created as MedicoBE])
      const mapped = mappedList[0] ?? null
      if (mapped) {
        // enriquecer con datos locales por si BE no devuelve todo
        mapped.nombre = form.nombre.trim()
        mapped.primerApellido = form.primerApellido.trim()
        mapped.segundoApellido = form.segundoApellido.trim()
        mapped.sexo = form.sexo
        mapped.codigo = codigo
        mapped.especialidad = form.especialidad
        mapped.telefono = form.telefono
        mapped.email = form.email
        mapped.ci = form.ci
        mapped.descripcion = form.descripcion
        mapped.ubicaciones = form.ubicaciones.filter(u => u.direccion.trim() || u.detalle.trim()).map((u, i) => ({ ...u, id: `u${i}` }))
        if (mapped.ubicaciones.length === 0) mapped.ubicaciones = [{ id: 'u0', direccion: '', detalle: '', coords: [-0.1807, -78.4678] }]
        setMedicos(prev => [...prev, mapped])
      } else {
        // fallback si map falla, añade visual
        const fallback: MedicoAdmin = {
          id: String(pid),
          nombre: form.nombre.trim(),
          primerApellido: form.primerApellido.trim(),
          segundoApellido: form.segundoApellido.trim(),
          sexo: form.sexo,
          codigo,
          especialidad: form.especialidad,
          hospital: '',
          telefono: form.telefono,
          email: form.email,
          ci: form.ci,
          descripcion: form.descripcion,
          ubicaciones: form.ubicaciones,
        }
        setMedicos(prev => [...prev, fallback])
      }
      setApiStatus(`Creado en API: ${form.nombre} ${form.primerApellido} (${codigo})`)
      setForm({ nombre: '', primerApellido: '', segundoApellido: '', sexo: '', codigo: '', especialidad: '', hospital: '', telefono: '', email: '', ci: '', descripcion: '', ubicaciones: [{ id: 'u0', direccion: '', detalle: '', coords: [-0.1807, -78.4678] }] })
      setShowCreate(false)
    } catch (err) {
      console.warn('[MedicosAdmin] create error', err)
      setApiStatus(`Error al crear médico: ${err instanceof Error ? err.message : String(err)} — no se guardó (solo DB)`)
    }
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm) return
    try {
      const pid = Number(editForm.id) || 1
      const especialidadId = editForm.especialidad ? Number(editForm.especialidad) : undefined
      await medicoService.update(pid, { especialidad_id: Number.isFinite(especialidadId as number) ? especialidadId : null as unknown as number, direccion: JSON.stringify(editForm.ubicaciones) as unknown as never } as never)
      setMedicos(prev => prev.map(m => (m.id === editForm.id ? editForm : m)))
      setApiStatus(`Actualizado en API: ${displayMedico(editForm.sexo, `${editForm.nombre} ${editForm.primerApellido}`)}`)
      setEditing(null)
      setEditForm(null)
    } catch (err) {
      console.warn('[MedicosAdmin] update error', err)
      setApiStatus(`Error al actualizar: ${err instanceof Error ? err.message : String(err)} — no se guardó (solo DB)`)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      const pid = Number(deleting.id)
      if (!Number.isFinite(pid)) throw new Error('ID inválido')
      await medicoService.remove(pid)
      setMedicos(prev => prev.filter(m => m.id !== deleting.id))
      setApiStatus(`Eliminado en API: ${displayMedico(deleting.sexo, deleting.nombre)}`)
      setDeleting(null)
    } catch (err) {
      console.warn('[MedicosAdmin] delete error', err)
      setApiStatus(`Error al eliminar: ${err instanceof Error ? err.message : String(err)} — no se eliminó (solo DB)`)
    }
  }

  const nombreCompleto = (m: MedicoAdmin) => `${m.nombre} ${m.primerApellido}${m.segundoApellido ? ' ' + m.segundoApellido : ''}`.trim()

  return (
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Médicos" searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar médico o especialidad...">
      <div className="pruebas-head">
        <div>
          <h2 className="pruebas-title">Médicos Registrados</h2>
          <p className="pruebas-sub">Gestiona profesionales médicos y sus ubicaciones asociadas.</p>
          <p style={{ fontSize: 11, color: loading ? '#2d9c9c' : '#6b7a99', marginTop: 4 }}>{loading ? 'Cargando...' : apiStatus}</p>
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
              {filtered.map(m => (
                <tr key={m.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{displayMedico(m.sexo, nombreCompleto(m))}</span>
                      <span style={{ fontSize: 11, color: '#7e8aa6' }}>{m.email}{m.codigo ? ` · ${m.codigo}` : ''}</span>
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
              {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#7e8aa6' }}>{medicos.length === 0 ? 'No hay médicos registrados' : 'Sin resultados.'}</td></tr>}
            </tbody>
          </table>
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
                <span>Matrícula</span><strong>{viewing.codigo || '—'}</strong>
                <span>Sexo</span><strong>{viewing.sexo ? (viewing.sexo.toLowerCase().startsWith('f') ? 'Femenino' : viewing.sexo.toLowerCase().startsWith('m') ? 'Masculino' : viewing.sexo) : '—'}</strong>
                <span>CI</span><strong>{viewing.ci || '—'}</strong>
                <span>Teléfono</span><strong>{viewing.telefono || '—'}</strong>
                <span>Email</span><strong>{viewing.email || '—'}</strong>
              </div>
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: '#1B2A4E', margin: '6px 0 8px' }}>Ubicaciones ({viewing.ubicaciones.length})</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {viewing.ubicaciones.map((u, idx) => (
                    <div key={u.id} style={{ border: '1px solid #e8ecf1', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E' }}>{idx + 1}. {u.direccion || u.hospital || 'Sin dirección'}</span>
                      {u.detalle && <span style={{ fontSize: 11, color: '#6b7a99' }}>{u.detalle}</span>}
                      <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e8ecf1' }}>
                        <MapContainer center={u.coords} zoom={14} scrollWheelZoom={false} zoomControl={false} style={{ height: 140, width: '100%' }}>
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
                          <Marker position={u.coords} />
                        </MapContainer>
                      </div>
                      <a href={`https://www.openstreetmap.org/?mlat=${u.coords[0]}&mlon=${u.coords[1]}#map=14/${u.coords[0]}/${u.coords[1]}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#2d9c9c', fontWeight: 600, textDecoration: 'none' }}>Abrir en OpenStreetMap ↗</a>
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
        <div className="vt-overlay" onClick={() => setShowCreate(false)}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head"><h3>Nuevo Médico</h3><button className="vt-modal-close" onClick={() => setShowCreate(false)} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleCreate} className="vt-form">
              <label>Nombre <span style={reqLabelStyle}>* obligatorio</span><input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Juan" /></label>
              <label>Primer Apellido <span style={reqLabelStyle}>* obligatorio</span><input required value={form.primerApellido} onChange={e => setForm({ ...form, primerApellido: e.target.value })} placeholder="Ej. Pérez" /></label>
              <label>Segundo Apellido <span style={optLabelStyle}>(opcional)</span><input value={form.segundoApellido} onChange={e => setForm({ ...form, segundoApellido: e.target.value })} placeholder="Ej. López" /></label>
              <label>Sexo <span style={optLabelStyle}>(opcional)</span>
                <select value={form.sexo} onChange={e => setForm({ ...form, sexo: e.target.value })}>
                  <option value="">Seleccione sexo</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                </select>
              </label>
              <label>Matrícula <span style={reqLabelStyle}>* obligatorio</span><input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="Ej. MED-12345 (autogenerado si vacío)" /></label>
              <label>Especialidad <span style={optLabelStyle}>(opcional)</span>
                <select value={form.especialidad} onChange={e => setForm({ ...form, especialidad: e.target.value })}>
                  <option value="">Seleccione especialidad</option>
                  {(especialidades ?? []).map(es => <option key={es.id} value={String(es.id)}>{es.nombre} ({es.codigo})</option>)}
                </select>
              </label>
              <label>Teléfono <span style={optLabelStyle}>(opcional)</span><input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="Ej. 0999999999" /></label>
              <label>Correo / Email <span style={optLabelStyle}>(opcional)</span><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ejemplo@correo.com" /></label>
              <label>CI <span style={optLabelStyle}>(opcional)</span><input value={form.ci} onChange={e => setForm({ ...form, ci: e.target.value })} placeholder="Ej. 1712345678" /></label>
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
                <button type="button" className="vt-btn vt-btn--ver" onClick={() => setForm({ ...form, ubicaciones: [...form.ubicaciones, { id: `u${Date.now()}`, direccion: '', detalle: '', coords: [-0.1807, -78.4678] }] })} style={{ alignSelf: 'flex-start' }}>+ Agregar ubicación</button>
              </div>
              <div className="vt-form-actions"><button type="button" className="vt-btn-cancel" onClick={() => setShowCreate(false)}>Cancelar</button><button type="submit" className="vt-btn-submit">Registrar</button></div>
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
              <label>Sexo <span style={optLabelStyle}>(opcional)</span>
                <select value={editForm.sexo} onChange={e => setEditForm({ ...editForm, sexo: e.target.value })}>
                  <option value="">Seleccione sexo</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                </select>
              </label>
              <label>Matrícula <span style={reqLabelStyle}>* obligatorio</span><input value={editForm.codigo} onChange={e => setEditForm({ ...editForm, codigo: e.target.value })} /></label>
              <label>Especialidad <span style={optLabelStyle}>(opcional)</span>
                <select value={editForm.especialidad} onChange={e => setEditForm({ ...editForm, especialidad: e.target.value })}>
                  <option value="">Seleccione especialidad</option>
                  {(especialidades ?? []).map(es => <option key={es.id} value={String(es.id)}>{es.nombre} ({es.codigo})</option>)}
                </select>
              </label>
              <label>Teléfono <span style={optLabelStyle}>(opcional)</span><input value={editForm.telefono} onChange={e => setEditForm({ ...editForm, telefono: e.target.value })} /></label>
              <label>Email <span style={optLabelStyle}>(opcional)</span><input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></label>
              <label>CI <span style={optLabelStyle}>(opcional)</span><input value={editForm.ci} onChange={e => setEditForm({ ...editForm, ci: e.target.value })} /></label>
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
                <button type="button" className="vt-btn vt-btn--ver" onClick={() => setEditForm({ ...editForm, ubicaciones: [...editForm.ubicaciones, { id: `u${Date.now()}`, direccion: '', detalle: '', coords: [-0.1807, -78.4678] }] } as MedicoAdmin)} style={{ alignSelf: 'flex-start' }}>+ Agregar ubicación</button>
              </div>
              <div className="vt-form-actions"><button type="button" className="vt-btn-cancel" onClick={() => { setEditing(null); setEditForm(null) }}>Cancelar</button><button type="submit" className="vt-btn-submit">Guardar Cambios</button></div>
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
              <p className="vt-delete-hint">Esta acción eliminará el registro en la base de datos ({ENV.API_URL}).</p>
              <div className="vt-form-actions"><button className="vt-btn-cancel" onClick={() => setDeleting(null)}>Cancelar</button><button className="vt-btn vt-btn--eliminar" onClick={handleDelete}>Eliminar</button></div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
