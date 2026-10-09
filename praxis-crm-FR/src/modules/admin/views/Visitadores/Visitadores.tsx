import { useState, useMemo, useEffect } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { MapPicker } from '../../components/MapPicker/MapPicker'
import { SuccessModal } from '../../components/SuccessModal/SuccessModal'
import { visitadorService, type VisitadorBE } from '../../../core/services/visitador.service'
import { getInitials, avatarStyle } from '../../../core/utils/avatar'
import { credencialesDetail } from '../../../core/utils/credenciales'
import './Visitadores.css'

type Estado = 'Activo' | 'Inactivo'

// Refleja Api/internal/visitador/models/visitador.go + persona base.
// BE create requiere: nombre, primer_apellido, sexo.
// BE update acepta: nombre, primer_apellido, telefono, activo, latitud, longitud.
interface Visitador {
  id: number
  nombre: string
  primerApellido: string
  segundoApellido: string
  sexo: string
  email: string
  telefono: string
  ci: string
  latitud: number | null
  longitud: number | null
  estado: Estado
}

interface Props {
  currentView: AdminView
  onNavigate: (v: AdminView) => void
  onLogout: () => void
}

const mapBEtoFE = (b: VisitadorBE): Visitador => ({
  id: b.persona_id,
  nombre: b.nombre || '',
  primerApellido: b.primer_apellido || '',
  segundoApellido: b.segundo_apellido || '',
  sexo: b.sexo || '',
  email: b.correo || '',
  telefono: b.telefono || '',
  ci: b.ci || '',
  latitud: b.latitud ?? null,
  longitud: b.longitud ?? null,
  estado: b.activo ? 'Activo' : 'Inactivo',
})

const fullName = (v: Pick<Visitador, 'nombre' | 'primerApellido' | 'segundoApellido'>) =>
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
  latitud: number | null
  longitud: number | null
  estado: Estado
}

const EMPTY_FORM: FormState = {
  nombre: '', primerApellido: '', segundoApellido: '', sexo: '',
  email: '', telefono: '', ci: '', latitud: null, longitud: null, estado: 'Activo',
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

export const VisitadoresView: React.FC<Props> = ({ currentView, onNavigate, onLogout }) => {
  const [visitadores, setVisitadores] = useState<Visitador[]>([])
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | Estado>('Todos')
  const [loading, setLoading] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Visitador | null>(null)
  const [deleting, setDeleting] = useState<Visitador | null>(null)
  const [viewing, setViewing] = useState<Visitador | null>(null)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editForm, setEditForm] = useState<(FormState & { id: number }) | null>(null)
  const [createdName, setCreatedName] = useState<string | null>(null)
  const [createdDetail, setCreatedDetail] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    visitadorService
      .list()
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data) && data.length > 0) {
          setVisitadores(data.map(mapBEtoFE))
        } else {
          setVisitadores([])
        }
      })
      .catch((err) => {
        console.warn('[Visitadores] API no disponible', err)
        if (cancelled) return
        setVisitadores([])
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    return visitadores.filter(v => {
      const matchEstado = filtroEstado === 'Todos' || v.estado === filtroEstado
      const q = search.trim().toLowerCase()
      const matchSearch = !q || fullName(v).toLowerCase().includes(q) || v.email.toLowerCase().includes(q) || v.telefono.includes(q) || v.ci.toLowerCase().includes(q)
      return matchEstado && matchSearch
    })
  }, [visitadores, search, filtroEstado])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim() || !form.primerApellido.trim() || !form.sexo || !form.email.trim()) return
    // lat/lng solo se envían si el usuario movió el pin (sino null = no guardar)
    const payload = {
      nombre: form.nombre.trim(),
      primer_apellido: form.primerApellido.trim(),
      segundo_apellido: form.segundoApellido.trim() || undefined,
      sexo: form.sexo,
      correo: form.email.trim(),
      telefono: form.telefono.trim(),
      ci: form.ci.trim(),
      latitud: form.latitud,
      longitud: form.longitud,
    }
    try {
      // El backend crea persona + visitador + users en UNA transacción y
      // manda el usuario y la contraseña generada al correo del formulario.
      const created = await visitadorService.create(payload)
      setApiError(null)
      setVisitadores((prev) => [...prev, mapBEtoFE(created)])
      setCreatedName(fullName({ nombre: form.nombre.trim(), primerApellido: form.primerApellido.trim(), segundoApellido: form.segundoApellido.trim() }))
      setCreatedDetail(credencialesDetail(created.password_generado, payload.correo))
      setForm(EMPTY_FORM)
      setShowCreate(false)
    } catch (err) {
      console.warn('[Visitadores] create error', err)
      // 409 = correo ya registrado; 400 = falta algún campo. Sin esto el
      // modal se cerraría igual y parecería que se creó.
      setApiError(err instanceof Error ? err.message : 'No se pudo crear el visitador')
    }
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm) return
    try {
      await visitadorService.update(editForm.id, {
        nombre: editForm.nombre.trim(),
        primer_apellido: editForm.primerApellido.trim(),
        telefono: editForm.telefono.trim(),
        activo: editForm.estado === 'Activo',
        latitud: editForm.latitud,
        longitud: editForm.longitud,
      })
      setVisitadores((prev) => prev.map((v) => (v.id === editForm.id ? {
        ...v,
        nombre: editForm.nombre.trim(),
        primerApellido: editForm.primerApellido.trim(),
        segundoApellido: editForm.segundoApellido.trim(),
        sexo: editForm.sexo,
        email: editForm.email.trim(),
        telefono: editForm.telefono.trim(),
        ci: editForm.ci.trim(),
        latitud: editForm.latitud,
        longitud: editForm.longitud,
        estado: editForm.estado,
      } : v)))
      setEditing(null)
      setEditForm(null)
    } catch (err) {
      console.warn('[Visitadores] update error', err)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await visitadorService.remove(deleting.id)
      setVisitadores((prev) => prev.filter((v) => v.id !== deleting.id))
      setDeleting(null)
    } catch (err) {
      console.warn('[Visitadores] delete error', err)
    }
  }

  return (
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Gestión de Visitadores" searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar visitador, correo, CI...">
      <div className="visitadores-head">
        <div>
          <h2 className="visitadores-title">Lista de Personal Técnico</h2>
          <p className="visitadores-sub">Al registrarlo se crea su cuenta de acceso y el usuario con la contraseña se envía a su correo.</p>
        </div>
        <button className="btn-registrar" onClick={() => { setApiError(null); setShowCreate(true) }}>+ Registrar Nuevo</button>
      </div>

      <div className="visitadores-toolbar">
        <label className="visitadores-filter">
          Estado:
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as 'Todos' | Estado)} className="visitadores-select">
            <option value="Todos">Todos</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </label>
        <span className="visitadores-count">{filtered.length} resultado(s)</span>
      </div>
      {(loading || apiError) && (
        <div style={{ fontSize: 11, color: apiError ? '#c0392b' : '#2d9c9c', margin: '6px 0 8px', fontWeight: 500 }}>
          {loading ? 'Cargando...' : apiError}
        </div>
      )}

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
                <tr key={v.id}>
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
                      <button className="vt-btn vt-btn--editar" onClick={() => { setEditing(v); setEditForm({ ...v, segundoApellido: v.segundoApellido, sexo: v.sexo, email: v.email, telefono: v.telefono, ci: v.ci, latitud: v.latitud, longitud: v.longitud, estado: v.estado }) }}>Editar</button>
                      <button className="vt-btn vt-btn--eliminar" onClick={() => setDeleting(v)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#7e8aa6' }}>{visitadores.length === 0 ? 'No hay visitadores registrados' : 'No se encontraron visitadores.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div className="vt-overlay" onClick={() => setShowCreate(false)}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head">
              <h3>Registrar Nuevo Visitador</h3>
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
              <label>Correo Electrónico <span style={reqStyle}>* obligatorio — ahí llegan usuario y contraseña</span><input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="correo@praxis.com" /></label>
              <label>Teléfono <span style={optStyle}>(opcional)</span><input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="+591 70000000" /></label>
              <label>CI <span style={optStyle}>(opcional)</span><input value={form.ci} onChange={e => setForm({ ...form, ci: e.target.value })} placeholder="Ej. 6543217" /></label>
              <label>Ubicación en mapa <span style={optStyle}>(opcional — vista previa Cochabamba, no se guarda)</span>
                <MapPicker
                  coords={form.latitud !== null && form.longitud !== null ? [form.latitud, form.longitud] : null}
                  onChange={c => setForm({ ...form, latitud: c[0], longitud: c[1] })}
                  height={160}
                />
              </label>
              {apiError && (
                <div style={{ fontSize: 11, color: '#c0392b', fontWeight: 500 }}>{apiError}</div>
              )}
              <div className="vt-form-actions">
                <button type="button" className="vt-btn-cancel" onClick={() => { setApiError(null); setShowCreate(false) }}>Cancelar</button>
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
              <h3>Editar Visitador</h3>
              <button className="vt-modal-close" onClick={() => { setEditing(null); setEditForm(null) }}>×</button>
            </div>
            <form onSubmit={handleEditSave} className="vt-form">
              <label>Nombre <span style={reqStyle}>* obligatorio</span><input required value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} /></label>
              <label>Primer Apellido <span style={reqStyle}>* obligatorio</span><input required value={editForm.primerApellido} onChange={e => setEditForm({ ...editForm, primerApellido: e.target.value })} /></label>
              <label>Segundo Apellido <span style={optStyle}>(opcional)</span><input value={editForm.segundoApellido} onChange={e => setEditForm({ ...editForm, segundoApellido: e.target.value })} /></label>
              <label>Correo Electrónico <span style={optStyle}>(opcional)</span><input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></label>
              <label>Teléfono <span style={optStyle}>(opcional)</span><input value={editForm.telefono} onChange={e => setEditForm({ ...editForm, telefono: e.target.value })} /></label>
              <label>CI <span style={optStyle}>(opcional)</span><input value={editForm.ci} onChange={e => setEditForm({ ...editForm, ci: e.target.value })} /></label>
              <label>Estado
                <select value={editForm.estado} onChange={e => setEditForm({ ...editForm, estado: e.target.value as Estado })}>
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </label>
              <label>Ubicación en mapa <span style={optStyle}>(opcional)</span>
                <MapPicker
                  coords={editForm.latitud !== null && editForm.longitud !== null ? [editForm.latitud, editForm.longitud] : null}
                  onChange={c => setEditForm({ ...editForm, latitud: c[0], longitud: c[1] })}
                  height={160}
                />
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
              <h3>Detalle del Visitador</h3>
              <button className="vt-modal-close" onClick={() => setViewing(null)}>×</button>
            </div>
            <div className="vt-view-body">
              <Avatar nombre={viewing.nombre} primerApellido={viewing.primerApellido} segundoApellido={viewing.segundoApellido} size={64} className="vt-view-avatar" />
              <h4>{fullName(viewing)}</h4>
              <p className="vt-view-email">{viewing.email || 'Sin correo'}</p>
              <div className="vt-view-grid">
                <span>Sexo</span><strong>{viewing.sexo || '—'}</strong>
                <span>Teléfono</span><strong>{viewing.telefono || '—'}</strong>
                <span>CI</span><strong>{viewing.ci || '—'}</strong>
                <span>Ubicación</span><strong>{viewing.latitud !== null && viewing.longitud !== null ? `${viewing.latitud.toFixed(5)}, ${viewing.longitud.toFixed(5)}` : 'Sin coordenadas'}</strong>
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
              <h3>Confirmar Eliminación</h3>
              <button className="vt-modal-close" onClick={() => setDeleting(null)}>×</button>
            </div>
            <div className="vt-delete-body">
              <div className="vt-delete-icon">⚠️</div>
              <p>¿Seguro que deseas eliminar a <strong>{fullName(deleting)}</strong>?</p>
              <p className="vt-delete-hint">Esta acción eliminará el registro en la base de datos.</p>
              <div className="vt-form-actions">
                <button className="vt-btn-cancel" onClick={() => setDeleting(null)}>Cancelar</button>
                <button className="vt-btn vt-btn--eliminar" onClick={handleDelete}>Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SuccessModal
        open={createdName !== null}
        onClose={() => { setCreatedName(null); setCreatedDetail(null) }}
        kind="visitador"
        name={createdName ?? ''}
        detail={createdDetail ?? undefined}
      />
    </AdminLayout>
  )
}
