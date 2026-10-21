import { useState, useMemo, useEffect } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { adminService, type AdminBE } from '../../../core/services/admin.service'
import { ciudadService, type Ciudad } from '../../../core/services/ciudad.service'
import { getInitials, avatarStyle } from '../../../core/utils/avatar'
import { credencialesDetail } from '../../../core/utils/credenciales'
import { SuccessModal } from '../../components/SuccessModal/SuccessModal'
import { ENV } from '../../../core/config/env'
import './Administradores.css'
import '../Visitadores/Visitadores.css'

type Estado = 'Activo' | 'Eliminado'

// Refleja AdminItem del backend: users + persona (transacción).
// status true(1)=activo, false(0)=eliminado lógico.
interface Administrador {
  personaId: number
  nombre: string
  primerApellido: string
  segundoApellido: string
  sexo: string
  email: string
  telefono: string
  ci: string
  ciudadId: number | null
  nacimiento: string
  estado: Estado
}

interface Props {
  currentView: AdminView
  onNavigate: (v: AdminView) => void
  onLogout: () => void
}

const mapBEtoFE = (b: AdminBE): Administrador => ({
  personaId: b.persona_id,
  nombre: b.nombre || '',
  primerApellido: b.primer_apellido || '',
  segundoApellido: b.segundo_apellido || '',
  sexo: b.sexo || '',
  email: b.email || '',
  telefono: b.telefono || '',
  ci: b.ci || '',
  ciudadId: b.ciudad_id ?? null,
  nacimiento: b.nacimiento ? b.nacimiento.slice(0, 10) : '',
  estado: b.status ? 'Activo' : 'Eliminado',
})

const fullName = (v: Pick<Administrador, 'nombre' | 'primerApellido' | 'segundoApellido'>) =>
  `${v.nombre} ${v.primerApellido}${v.segundoApellido ? ' ' + v.segundoApellido : ''}`.trim()

const reqStyle: React.CSSProperties = { color: '#8a9ab5', fontWeight: 400, fontSize: 10, opacity: 0.85, marginLeft: 4, textTransform: 'lowercase' }
const optStyle: React.CSSProperties = { color: '#8a9ab5', fontWeight: 400, fontSize: 10, opacity: 0.75, marginLeft: 4, textTransform: 'lowercase' }

type FormState = {
  nombre: string
  primerApellido: string
  segundoApellido: string
  sexo: string
  email: string
  telefono: string
  ci: string
  ciudadId: number | null
  nacimiento: string
  estado: Estado
}

// El formulario de edición sigue pudiendo resetear la contraseña a mano
// (vacío = no cambia): lo que se quitó es el campo del alta, porque ahí la
// genera el backend y la manda por correo.
type EditFormState = FormState & { personaId: number; password: string }

const EMPTY_FORM: FormState = {
  nombre: '', primerApellido: '', segundoApellido: '', sexo: '',
  email: '', telefono: '', ci: '', ciudadId: null, nacimiento: '', estado: 'Activo',
}

const Avatar: React.FC<{ nombre: string; primerApellido: string; segundoApellido?: string; size?: number; className?: string }> = ({ nombre, primerApellido, segundoApellido, size = 28, className }) => (
  <span
    aria-hidden
    className={className}
    style={{
      width: size, height: size, borderRadius: '50%', display: 'inline-grid', placeItems: 'center',
      fontSize: size * 0.38, fontWeight: 800, letterSpacing: 0.5, flexShrink: 0,
      ...avatarStyle(`${nombre} ${primerApellido}`),
    }}
  >
    {getInitials(nombre, primerApellido, segundoApellido)}
  </span>
)

export const AdministradoresView: React.FC<Props> = ({ currentView, onNavigate, onLogout }) => {
  const [admins, setAdmins] = useState<Administrador[]>([])
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | Estado>('Todos')
  const [loading, setLoading] = useState(false)
  const [apiStatus, setApiStatus] = useState<string>(`API: ${ENV.API_URL}`)

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Administrador | null>(null)
  const [deleting, setDeleting] = useState<Administrador | null>(null)
  const [viewing, setViewing] = useState<Administrador | null>(null)
  const [createdName, setCreatedName] = useState<string | null>(null)
  const [createdDetail, setCreatedDetail] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editForm, setEditForm] = useState<EditFormState | null>(null)
  const [ciudades, setCiudades] = useState<Ciudad[]>([])

  useEffect(() => {
    ciudadService.list().then(d => setCiudades(Array.isArray(d) ? d : [])).catch(() => setCiudades([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    adminService
      .list()
      .then((data) => {
        if (cancelled) return
        const rows = Array.isArray(data) ? data.map(mapBEtoFE) : []
        setAdmins(rows)
        setApiStatus(`Conectado a ${ENV.API_URL} — ${rows.length} administradores desde /api/admins`)
      })
      .catch((err) => {
        console.warn('[Administradores] API no disponible', err)
        if (cancelled) return
        setAdmins([])
        setApiStatus(`Error: sin conexión a ${ENV.API_URL} — ${err instanceof Error ? err.message : 'no se pudo cargar administradores'}`)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    return admins.filter(v => {
      const matchEstado = filtroEstado === 'Todos' || v.estado === filtroEstado
      const q = search.trim().toLowerCase()
      const matchSearch = !q || fullName(v).toLowerCase().includes(q) || v.email.toLowerCase().includes(q) || v.ci.toLowerCase().includes(q)
      return matchEstado && matchSearch
    })
  }, [admins, search, filtroEstado])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim() || !form.primerApellido.trim() || !form.sexo || !form.email.trim()) return
    try {
      // POST /api/admins: inserta persona + users (rol admin) en UNA
      // transacción. No se manda contraseña: la genera el backend y la
      // envía por correo al email del formulario.
      const created = await adminService.create({
        email: form.email.trim().toLowerCase(),
        nombre: form.nombre.trim(),
        primer_apellido: form.primerApellido.trim(),
        segundo_apellido: form.segundoApellido.trim() || undefined,
        sexo: form.sexo,
        telefono: form.telefono.trim(),
        ci: form.ci.trim(),
        ciudad_id: form.ciudadId,
        nacimiento: form.nacimiento || null,
      })
      setAdmins((prev) => [...prev, mapBEtoFE(created)])
      setApiStatus(`Creado en ${ENV.API_URL} → ${form.nombre} ${form.primerApellido}`)
      setCreatedName(fullName({ nombre: form.nombre.trim(), primerApellido: form.primerApellido.trim(), segundoApellido: form.segundoApellido.trim() }))
      setCreatedDetail(credencialesDetail(created.password_generado, form.email.trim()))
      setForm(EMPTY_FORM)
      setShowCreate(false)
    } catch (err) {
      console.warn('[Administradores] create error', err)
      setApiStatus(`Error al crear administrador: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm) return
    try {
      // PUT /api/admins/{persona_id}: actualiza persona + credencial en UNA transacción.
      // status true=Activo, false=Eliminado (permite reactivar).
      const updated = await adminService.update(editForm.personaId, {
        nombre: editForm.nombre.trim(),
        primer_apellido: editForm.primerApellido.trim(),
        segundo_apellido: editForm.segundoApellido.trim() || null,
        sexo: editForm.sexo,
        telefono: editForm.telefono.trim(),
        ci: editForm.ci.trim(),
        ciudad_id: editForm.ciudadId,
        nacimiento: editForm.nacimiento || null,
        correo: editForm.email.trim(),
        email: editForm.email.trim(),
        password: editForm.password.trim() || undefined,
        status: editForm.estado === 'Activo',
      })
      setAdmins((prev) => prev.map((v) => (v.personaId === editForm.personaId ? mapBEtoFE(updated) : v)))
      setApiStatus(`Actualizado en API: ${editForm.nombre} ${editForm.primerApellido}`)
      setEditing(null)
      setEditForm(null)
    } catch (err) {
      console.warn('[Administradores] update error', err)
      setApiStatus(`Error al actualizar: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      // DELETE /api/admins/{persona_id}: eliminación LÓGICA (status 1 -> 0)
      await adminService.remove(deleting.personaId)
      setAdmins((prev) => prev.map((v) => (v.personaId === deleting.personaId ? { ...v, estado: 'Eliminado' as Estado } : v)))
      setApiStatus(`Desactivado en API (baja lógica): ${fullName(deleting)}`)
      setDeleting(null)
    } catch (err) {
      console.warn('[Administradores] delete error', err)
      setApiStatus(`Error al eliminar: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Gestión de Administradores" searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar administrador, correo, CI...">
      <div className="visitadores-head">
        <div>
          <h2 className="visitadores-title">Administradores del Sistema</h2>
          <p className="visitadores-sub">Cuentas con rol admin: persona + usuario en una transacción. La contraseña la genera el sistema y se envía al correo. La eliminación es lógica (activo → eliminado).</p>
        </div>
        <button className="btn-registrar" onClick={() => setShowCreate(true)}>+ Registrar Nuevo</button>
      </div>

      <div className="visitadores-toolbar">
        <label className="visitadores-filter">
          Estado:
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as 'Todos' | Estado)} className="visitadores-select">
            <option value="Todos">Todos</option>
            <option value="Activo">Activo</option>
            <option value="Eliminado">Eliminado</option>
          </select>
        </label>
        <span className="visitadores-count">{filtered.length} resultado(s)</span>
      </div>
      <div style={{ fontSize: 11, color: loading ? '#2d9c9c' : '#6b7a99', margin: '6px 0 8px', fontWeight: 500 }}>
        {loading ? 'Cargando desde API...' : apiStatus}
      </div>

      <div className="visitadores-card">
        <div className="visitadores-table-wrap">
          <table className="visitadores-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo Electrónico</th>
                <th>Teléfono</th>
                <th>CI</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.personaId}>
                  <td>
                    <div className="vt-name-cell">
                      <Avatar nombre={v.nombre} primerApellido={v.primerApellido} segundoApellido={v.segundoApellido} size={28} className="vt-avatar" />
                      <span className="vt-nombre">{fullName(v)}</span>
                    </div>
                  </td>
                  <td className="vt-email">{v.email || '—'}</td>
                  <td className="vt-tel">{v.telefono || '—'}</td>
                  <td className="vt-tel">{v.ci || '—'}</td>
                  <td>
                    <span className={`vt-badge ${v.estado === 'Activo' ? 'vt-badge--activo' : 'vt-badge--inactivo'}`}>
                      <span className="vt-dot" /> {v.estado}
                    </span>
                  </td>
                  <td>
                    <div className="vt-actions">
                      <button className="vt-btn vt-btn--ver" onClick={() => setViewing(v)}>Ver</button>
                      <button className="vt-btn vt-btn--editar" onClick={() => { setEditing(v); setEditForm({ ...v, password: '' }) }}>Editar</button>
                      {v.estado === 'Activo' && <button className="vt-btn vt-btn--eliminar" onClick={() => setDeleting(v)}>Eliminar</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#7e8aa6' }}>{admins.length === 0 ? 'No hay administradores registrados en la base de datos' : 'No se encontraron administradores.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="vt-overlay" onClick={() => setShowCreate(false)}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head">
              <h3>Registrar Nuevo Administrador</h3>
              <button className="vt-modal-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form onSubmit={handleCreate} className="vt-form">
              <label>Nombre <span style={reqStyle}>* obligatorio</span><input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Daniel" /></label>
              <label>Primer Apellido <span style={reqStyle}>* obligatorio</span><input required value={form.primerApellido} onChange={e => setForm({ ...form, primerApellido: e.target.value })} placeholder="Ej. Campos" /></label>
              <label>Segundo Apellido <span style={optStyle}>(opcional)</span><input value={form.segundoApellido} onChange={e => setForm({ ...form, segundoApellido: e.target.value })} placeholder="Ej. Dalence" /></label>
              <label>Sexo <span style={reqStyle}>* obligatorio</span>
                <select required value={form.sexo} onChange={e => setForm({ ...form, sexo: e.target.value })}>
                  <option value="">Seleccione sexo</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                </select>
              </label>
              <label>Email de acceso <span style={reqStyle}>* obligatorio — ahí llegan usuario y contraseña</span><input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="admin@praxis.bo" /></label>
              <label>Teléfono <span style={optStyle}>(opcional)</span><input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="+591 70000000" /></label>
              <label>CI <span style={optStyle}>(opcional)</span><input value={form.ci} onChange={e => setForm({ ...form, ci: e.target.value })} placeholder="Ej. 6543217" /></label>
              <label>Ciudad <span style={optStyle}>(opcional)</span>
                <select value={form.ciudadId ?? ''} onChange={e => setForm({ ...form, ciudadId: e.target.value === '' ? null : Number(e.target.value) })}>
                  <option value="">Sin ciudad</option>
                  {ciudades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
              <label>Fecha de nacimiento <span style={optStyle}>(opcional)</span><input type="date" value={form.nacimiento} onChange={e => setForm({ ...form, nacimiento: e.target.value })} /></label>
              <div className="vt-form-actions">
                <button type="button" className="vt-btn-cancel" onClick={() => setShowCreate(false)}>Cancelar</button>
                <button type="submit" className="vt-btn-submit">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && editForm && (
        <div className="vt-overlay" onClick={() => { setEditing(null); setEditForm(null) }}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head">
              <h3>Editar Administrador</h3>
              <button className="vt-modal-close" onClick={() => { setEditing(null); setEditForm(null) }}>×</button>
            </div>
            <form onSubmit={handleEditSave} className="vt-form">
              <label>Nombre <span style={reqStyle}>* obligatorio</span><input required value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} /></label>
              <label>Primer Apellido <span style={reqStyle}>* obligatorio</span><input required value={editForm.primerApellido} onChange={e => setEditForm({ ...editForm, primerApellido: e.target.value })} /></label>
              <label>Segundo Apellido <span style={optStyle}>(opcional)</span><input value={editForm.segundoApellido} onChange={e => setEditForm({ ...editForm, segundoApellido: e.target.value })} /></label>
              <label>Email de acceso <span style={reqStyle}>* obligatorio</span><input required type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></label>
              <label>Nueva contraseña <span style={optStyle}>(vacío = no cambia)</span><input type="password" minLength={6} value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} placeholder="Dejar vacío para no cambiar" /></label>
              <label>Teléfono <span style={optStyle}>(opcional)</span><input value={editForm.telefono} onChange={e => setEditForm({ ...editForm, telefono: e.target.value })} /></label>
              <label>CI <span style={optStyle}>(opcional)</span><input value={editForm.ci} onChange={e => setEditForm({ ...editForm, ci: e.target.value })} /></label>
              <label>Ciudad <span style={optStyle}>(opcional)</span>
                <select value={editForm.ciudadId ?? ''} onChange={e => setEditForm({ ...editForm, ciudadId: e.target.value === '' ? null : Number(e.target.value) })}>
                  <option value="">Sin ciudad</option>
                  {ciudades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
              <label>Fecha de nacimiento <span style={optStyle}>(opcional)</span><input type="date" value={editForm.nacimiento} onChange={e => setEditForm({ ...editForm, nacimiento: e.target.value })} /></label>
              <label>Estado <span style={optStyle}>(Eliminado = baja lógica, reactivable)</span>
                <select value={editForm.estado} onChange={e => setEditForm({ ...editForm, estado: e.target.value as Estado })}>
                  <option value="Activo">Activo</option>
                  <option value="Eliminado">Eliminado</option>
                </select>
              </label>
              <div className="vt-form-actions">
                <button type="button" className="vt-btn-cancel" onClick={() => { setEditing(null); setEditForm(null) }}>Cancelar</button>
                <button type="submit" className="vt-btn-submit">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewing && (
        <div className="vt-overlay" onClick={() => setViewing(null)}>
          <div className="vt-modal vt-modal--sm" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head">
              <h3>Detalle del Administrador</h3>
              <button className="vt-modal-close" onClick={() => setViewing(null)}>×</button>
            </div>
            <div className="vt-view-body">
              <Avatar nombre={viewing.nombre} primerApellido={viewing.primerApellido} segundoApellido={viewing.segundoApellido} size={64} className="vt-view-avatar" />
              <h4>{fullName(viewing)}</h4>
              <p className="vt-view-email">{viewing.email}</p>
              <div className="vt-view-grid">
                <span>Sexo</span><strong>{viewing.sexo || '—'}</strong>
                <span>Teléfono</span><strong>{viewing.telefono || '—'}</strong>
                <span>CI</span><strong>{viewing.ci || '—'}</strong>
                <span>Nacimiento</span><strong>{viewing.nacimiento || '—'}</strong>
                <span>Ciudad</span><strong>{viewing.ciudadId ? (ciudades.find(c => c.id === viewing.ciudadId)?.nombre || viewing.ciudadId) : '—'}</strong>
                <span>Estado</span><span className={`vt-badge ${viewing.estado === 'Activo' ? 'vt-badge--activo' : 'vt-badge--inactivo'}`}><span className="vt-dot" /> {viewing.estado}</span>
              </div>
              <button className="vt-btn-submit" style={{ width: '100%', marginTop: 16 }} onClick={() => setViewing(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="vt-overlay" onClick={() => setDeleting(null)}>
          <div className="vt-modal vt-modal--sm" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head">
              <h3>Confirmar Baja Lógica</h3>
              <button className="vt-modal-close" onClick={() => setDeleting(null)}>×</button>
            </div>
            <div className="vt-delete-body">
              <div className="vt-delete-icon">⚠️</div>
              <p>¿Desactivar a <strong>{fullName(deleting)}</strong>?</p>
              <p className="vt-delete-hint">Eliminación lógica: status 1 → 0. No se borra de la BD y se puede reactivar desde Editar.</p>
              <div className="vt-form-actions">
                <button className="vt-btn-cancel" onClick={() => setDeleting(null)}>Cancelar</button>
                <button className="vt-btn vt-btn--eliminar" onClick={handleDelete}>Desactivar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SuccessModal
        open={createdName !== null}
        onClose={() => { setCreatedName(null); setCreatedDetail(null) }}
        kind="administrador"
        name={createdName ?? ''}
        detail={createdDetail ?? undefined}
      />
    </AdminLayout>
  )
}
