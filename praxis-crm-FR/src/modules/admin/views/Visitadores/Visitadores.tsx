import { useState, useMemo, useEffect } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { visitadorService, type VisitadorBE } from '../../../core/services/visitador.service'
import './Visitadores.css'

type Estado = 'Activo' | 'Inactivo'

interface Visitador {
  id: number
  nombre: string
  email: string
  telefono: string
  latitud: number | null
  longitud: number | null
  visitas: number
  estado: Estado
  avatar: string
}

interface Props {
  currentView: AdminView
  onNavigate: (v: AdminView) => void
  onLogout: () => void
}

const mapBEtoFE = (b: VisitadorBE, idx: number): Visitador => ({
  id: b.persona_id || idx + 1,
  nombre: `${b.nombre} ${b.primer_apellido}${b.segundo_apellido ? ' ' + b.segundo_apellido : ''}`.trim(),
  email: b.correo || '',
  telefono: b.telefono || '',
  latitud: b.latitud ?? null,
  longitud: b.longitud ?? null,
  visitas: 0,
  estado: b.activo ? 'Activo' : 'Inactivo',
  avatar: `https://i.pravatar.cc/100?img=${10 + ((b.persona_id || idx) % 60)}`,
})

export const VisitadoresView: React.FC<Props> = ({ currentView, onNavigate, onLogout }) => {
  const [visitadores, setVisitadores] = useState<Visitador[]>([])
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | Estado>('Activo')
  const [loading, setLoading] = useState(false)

  // popups
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Visitador | null>(null)
  const [deleting, setDeleting] = useState<Visitador | null>(null)
  const [viewing, setViewing] = useState<Visitador | null>(null)

  // form state - sin campo estado (siempre Activo al crear)
  const [form, setForm] = useState<Omit<Visitador, 'id' | 'avatar' | 'estado'> & { avatar?: string }>({ nombre: '', email: '', telefono: '', latitud: null, longitud: null, visitas: 0 })
  const [editForm, setEditForm] = useState<Visitador | null>(null)

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
      const matchSearch = !q || v.nombre.toLowerCase().includes(q) || v.email.toLowerCase().includes(q) || v.telefono.includes(q)
      return matchEstado && matchSearch
    })
  }, [visitadores, search, filtroEstado])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim() || !form.email.trim()) return
    const partes = form.nombre.trim().split(/\s+/)
    const payload = {
      nombre: partes[0] || form.nombre.trim(),
      primer_apellido: partes.slice(1).join(' ') || '—',
      correo: form.email.trim(),
      telefono: form.telefono.trim(),
      latitud: form.latitud,
      longitud: form.longitud,
    }
    try {
      const created = await visitadorService.create(payload)
      const mapped = mapBEtoFE(created, visitadores.length + 1)
      // preserva visitas del form
      mapped.visitas = Number(form.visitas) || 0
      setVisitadores((prev) => [...prev, mapped])
      setForm({ nombre: '', email: '', telefono: '', latitud: null, longitud: null, visitas: 0 })
      setShowCreate(false)
    } catch (err) {
      console.warn('[Visitadores] create error', err)
    }
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm) return
    try {
      await visitadorService.update(editForm.id, {
        nombre: editForm.nombre.split(' ')[0] || editForm.nombre,
        primer_apellido: editForm.nombre.split(' ').slice(1).join(' ') || editForm.nombre,
        telefono: editForm.telefono,
        activo: editForm.estado === 'Activo',
        latitud: editForm.latitud,
        longitud: editForm.longitud,
      })
      setVisitadores((prev) => prev.map((v) => (v.id === editForm.id ? editForm : v)))
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
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Gestión de Visitadores" searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar visitas, técnicos, labs...">
      <div className="visitadores-head">
        <div>
          <h2 className="visitadores-title">Lista de Personal Técnico</h2>
          <p className="visitadores-sub">Registra, edita y supervisa a los técnicos visitadores activos en terreno.</p>
        </div>
        <button className="btn-registrar" onClick={() => setShowCreate(true)}>+ Registrar Nuevo</button>
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
      {loading && (
        <div style={{ fontSize: 11, color: '#2d9c9c', margin: '6px 0 8px', fontWeight: 500 }}>Cargando...</div>
      )}

      <div className="visitadores-card">
        <div className="visitadores-table-wrap">
          <table className="visitadores-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo Electrónico</th>
                <th>Teléfono</th>
                <th>Visitas (Mes)</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id}>
                  <td>
                    <div className="vt-name-cell">
                      <img src={v.avatar} alt={v.nombre} className="vt-avatar" />
                      <span className="vt-nombre">{v.nombre}</span>
                    </div>
                  </td>
                  <td className="vt-email">{v.email}</td>
                  <td className="vt-tel">{v.telefono}</td>
                  <td className="vt-visitas">{v.visitas}</td>
                  <td>
                    <span className={`vt-badge ${v.estado === 'Activo' ? 'vt-badge--activo' : 'vt-badge--inactivo'}`}>
                      <span className="vt-dot" /> {v.estado}
                    </span>
                  </td>
                  <td>
                    <div className="vt-actions">
                      <button className="vt-btn vt-btn--ver" onClick={() => setViewing(v)}>Ver</button>
                      <button className="vt-btn vt-btn--editar" onClick={() => { setEditing(v); setEditForm({ ...v }) }}>Editar</button>
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

      {/* Popup Crear */}
      {showCreate && (
        <div className="vt-overlay" onClick={() => setShowCreate(false)}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head">
              <h3>Registrar Nuevo Visitador</h3>
              <button className="vt-modal-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form onSubmit={handleCreate} className="vt-form">
              <label>Nombre<input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre completo" /></label>
              <label>Correo Electrónico<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="correo@praxis.com" /></label>
              <label>Teléfono<input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="+56 9 1234 5678" /></label>
              <label>Visitas (Mes)<input type="number" min={0} value={form.visitas} onChange={e => setForm({ ...form, visitas: Number(e.target.value) })} /></label>
              <label>Latitud<input type="number" step="any" value={form.latitud ?? ''} onChange={e => setForm({ ...form, latitud: e.target.value === '' ? null : Number(e.target.value) })} placeholder="-17.7863" /></label>
              <label>Longitud<input type="number" step="any" value={form.longitud ?? ''} onChange={e => setForm({ ...form, longitud: e.target.value === '' ? null : Number(e.target.value) })} placeholder="-63.1812" /></label>
              <div className="vt-form-actions">
                <button type="button" className="vt-btn-cancel" onClick={() => setShowCreate(false)}>Cancelar</button>
                <button type="submit" className="vt-btn-submit">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Popup Editar */}
      {editing && editForm && (
        <div className="vt-overlay" onClick={() => { setEditing(null); setEditForm(null) }}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head">
              <h3>Editar Visitador</h3>
              <button className="vt-modal-close" onClick={() => { setEditing(null); setEditForm(null) }}>×</button>
            </div>
            <form onSubmit={handleEditSave} className="vt-form">
              <label>Nombre<input required value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} /></label>
              <label>Correo Electrónico<input required type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></label>
              <label>Teléfono<input value={editForm.telefono} onChange={e => setEditForm({ ...editForm, telefono: e.target.value })} /></label>
              <label>Visitas (Mes)<input type="number" min={0} value={editForm.visitas} onChange={e => setEditForm({ ...editForm, visitas: Number(e.target.value) })} /></label>
              <label>Latitud<input type="number" step="any" value={editForm.latitud ?? ''} onChange={e => setEditForm({ ...editForm, latitud: e.target.value === '' ? null : Number(e.target.value) })} /></label>
              <label>Longitud<input type="number" step="any" value={editForm.longitud ?? ''} onChange={e => setEditForm({ ...editForm, longitud: e.target.value === '' ? null : Number(e.target.value) })} /></label>
              <div className="vt-form-actions">
                <button type="button" className="vt-btn-cancel" onClick={() => { setEditing(null); setEditForm(null) }}>Cancelar</button>
                <button type="submit" className="vt-btn-submit">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Popup Ver */}
      {viewing && (
        <div className="vt-overlay" onClick={() => setViewing(null)}>
          <div className="vt-modal vt-modal--sm" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head">
              <h3>Detalle del Visitador</h3>
              <button className="vt-modal-close" onClick={() => setViewing(null)}>×</button>
            </div>
            <div className="vt-view-body">
              <img src={viewing.avatar} alt={viewing.nombre} className="vt-view-avatar" />
              <h4>{viewing.nombre}</h4>
              <p className="vt-view-email">{viewing.email}</p>
              <div className="vt-view-grid">
                <span>Teléfono</span><strong>{viewing.telefono}</strong>
                <span>Visitas</span><strong>{viewing.visitas}</strong>
                <span>Ubicación</span><strong>{viewing.latitud !== null && viewing.longitud !== null ? `${viewing.latitud.toFixed(5)}, ${viewing.longitud.toFixed(5)}` : 'Sin coordenadas'}</strong>
                <span>Estado</span><span className={`vt-badge ${viewing.estado === 'Activo' ? 'vt-badge--activo' : 'vt-badge--inactivo'}`}><span className="vt-dot" /> {viewing.estado}</span>
              </div>
              <button className="vt-btn-submit" style={{ width: '100%', marginTop: 16 }} onClick={() => setViewing(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Popup Eliminar confirmación */}
      {deleting && (
        <div className="vt-overlay" onClick={() => setDeleting(null)}>
          <div className="vt-modal vt-modal--sm" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head">
              <h3>Confirmar Eliminación</h3>
              <button className="vt-modal-close" onClick={() => setDeleting(null)}>×</button>
            </div>
            <div className="vt-delete-body">
              <div className="vt-delete-icon">⚠️</div>
              <p>¿Seguro que deseas eliminar a <strong>{deleting.nombre}</strong>?</p>
              <p className="vt-delete-hint">Esta acción eliminará el registro de forma permanente.</p>
              <div className="vt-form-actions">
                <button className="vt-btn-cancel" onClick={() => setDeleting(null)}>Cancelar</button>
                <button className="vt-btn vt-btn--eliminar" onClick={handleDelete}>Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
