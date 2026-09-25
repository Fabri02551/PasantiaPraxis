import { useState, useMemo, useEffect } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { especialidadService, type Especialidad } from '../../../core/services/especialidad.service'
import { ENV } from '../../../core/config/env'
import './Especialidades.css'
import '../Visitadores/Visitadores.css'

export const EspecialidadesView: React.FC<{ currentView: AdminView; onNavigate: (v: AdminView) => void; onLogout: () => void }> = ({ currentView, onNavigate, onLogout }) => {
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<Especialidad | null>(null)
  const [editing, setEditing] = useState<Especialidad | null>(null)
  const [editForm, setEditForm] = useState<Especialidad | null>(null)
  const [deleting, setDeleting] = useState<Especialidad | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ nombre: '', codigo: '' })
  const [apiStatus, setApiStatus] = useState(`API: ${ENV.API_URL}`)
  const [loading, setLoading] = useState(false)

  const reqStyle: React.CSSProperties = { color: '#8a9ab5', fontWeight: 400, fontSize: 10, opacity: 0.85, marginLeft: 4, textTransform: 'lowercase' }
  // const optStyle: React.CSSProperties = { color: '#8a9ab5', fontWeight: 400, fontSize: 10, opacity: 0.75, marginLeft: 4, textTransform: 'lowercase' }

  const load = async () => {
    setLoading(true)
    try {
      const data = await especialidadService.list()
      if (Array.isArray(data)) {
        setEspecialidades(data)
        setApiStatus(`Conectado a ${ENV.API_URL} — ${data.length} especialidades`)
      } else {
        setEspecialidades([])
        setApiStatus(`Conectado a ${ENV.API_URL} — sin datos`)
      }
    } catch (err) {
      console.warn('[Especialidades] API no disponible', err)
      setEspecialidades([])
      setApiStatus(`Error: sin conexión a ${ENV.API_URL} — ${err instanceof Error ? err.message : 'error'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return especialidades
    return especialidades.filter(e => e.nombre.toLowerCase().includes(q) || e.codigo.toLowerCase().includes(q))
  }, [especialidades, search])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim() || !form.codigo.trim()) return
    try {
      const created = await especialidadService.create({ nombre: form.nombre.trim(), codigo: form.codigo.trim().toUpperCase() })
      setEspecialidades(prev => [...prev, created])
      setApiStatus(`Creado en API: ${form.nombre} (${form.codigo})`)
      setForm({ nombre: '', codigo: '' })
      setShowCreate(false)
    } catch (err) {
      console.warn('[Especialidades] create error', err)
      setApiStatus(`Error al crear: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm) return
    try {
      const updated = await especialidadService.update(editForm.id, { nombre: editForm.nombre, codigo: editForm.codigo, status: editForm.status })
      setEspecialidades(prev => prev.map(es => es.id === updated.id ? updated : es))
      setApiStatus(`Actualizado: ${updated.nombre}`)
      setEditing(null)
      setEditForm(null)
    } catch (err) {
      console.warn('[Especialidades] update error', err)
      setApiStatus(`Error al actualizar: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await especialidadService.remove(deleting.id)
      setEspecialidades(prev => prev.filter(es => es.id !== deleting.id))
      setApiStatus(`Eliminado: ${deleting.nombre}`)
      setDeleting(null)
    } catch (err) {
      console.warn('[Especialidades] delete error', err)
      setApiStatus(`Error al eliminar: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Especialidades" searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar especialidad o código...">
      <div className="pruebas-head">
        <div>
          <h2 className="pruebas-title">Especialidades Médicas</h2>
          <p className="pruebas-sub">Gestiona las especialidades médicas disponibles para los médicos. Campos DB: nombre (obligatorio), código (obligatorio único), status.</p>
          <p style={{ fontSize: 11, color: loading ? '#2d9c9c' : '#6b7a99', marginTop: 4 }}>{loading ? 'Cargando...' : apiStatus}</p>
        </div>
        <button className="btn-registrar" onClick={() => setShowCreate(true)}>+ Nueva Especialidad</button>
      </div>

      <div className="pruebas-card">
        <div className="pruebas-table-wrap">
          <table className="pruebas-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Código</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(es => (
                <tr key={es.id}>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>{es.nombre}</td>
                  <td><span className="pruebas-codigo">{es.codigo}</span></td>
                  <td><span className={`vt-badge ${es.status ? 'vt-badge--activo' : 'vt-badge--inactivo'}`}><span className="vt-dot" />{es.status ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div className="pruebas-actions">
                      <button className="vt-btn vt-btn--ver" onClick={() => setViewing(es)}>Ver</button>
                      <button className="vt-btn vt-btn--editar" onClick={() => { setEditing(es); setEditForm({ ...es }) }}>Editar</button>
                      <button className="vt-btn vt-btn--eliminar" onClick={() => setDeleting(es)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#7e8aa6' }}>{especialidades.length === 0 ? 'Sin especialidades registradas' : 'Sin resultados.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <div className="vt-overlay" onClick={() => setViewing(null)}>
          <div className="vt-modal vt-modal--sm" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head"><h3>Detalle de Especialidad</h3><button className="vt-modal-close" onClick={() => setViewing(null)} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <div className="vt-view-body" style={{ textAlign: 'left' }}>
              <div className="vt-view-grid">
                <span>Nombre</span><strong>{viewing.nombre}</strong>
                <span>Código</span><strong>{viewing.codigo}</strong>
                <span>Estado</span><strong>{viewing.status ? 'Activo' : 'Inactivo'}</strong>
                <span>ID</span><strong>{viewing.id}</strong>
              </div>
              <button className="vt-btn-submit" style={{ width: '100%', marginTop: 16 }} onClick={() => setViewing(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="vt-overlay" onClick={() => setShowCreate(false)}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head"><h3>Nueva Especialidad</h3><button className="vt-modal-close" onClick={() => setShowCreate(false)} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleCreate} className="vt-form">
              <label>Nombre <span style={reqStyle}>* obligatorio</span><input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Cardiología" /></label>
              <label>Código <span style={reqStyle}>* obligatorio</span><input required value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })} placeholder="Ej. CARD-001" /></label>
              <div className="vt-form-actions"><button type="button" className="vt-btn-cancel" onClick={() => setShowCreate(false)}>Cancelar</button><button type="submit" className="vt-btn-submit">Registrar</button></div>
            </form>
          </div>
        </div>
      )}

      {editing && editForm && (
        <div className="vt-overlay" onClick={() => { setEditing(null); setEditForm(null) }}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head"><h3>Editar Especialidad</h3><button className="vt-modal-close" onClick={() => { setEditing(null); setEditForm(null) }} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleEditSave} className="vt-form">
              <label>Nombre <span style={reqStyle}>* obligatorio</span><input required value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} /></label>
              <label>Código <span style={reqStyle}>* obligatorio</span><input required value={editForm.codigo} onChange={e => setEditForm({ ...editForm, codigo: e.target.value.toUpperCase() })} /></label>
              <label>Estado
                <select value={editForm.status ? 'true' : 'false'} onChange={e => setEditForm({ ...editForm, status: e.target.value === 'true' })}>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </label>
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
              <p>¿Eliminar <strong>{deleting.nombre}</strong> ({deleting.codigo})?</p>
              <p className="vt-delete-hint">Se eliminará de la base de datos ({ENV.API_URL}/api/especialidades).</p>
              <div className="vt-form-actions"><button className="vt-btn-cancel" onClick={() => setDeleting(null)}>Cancelar</button><button className="vt-btn vt-btn--eliminar" onClick={handleDelete}>Eliminar</button></div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
