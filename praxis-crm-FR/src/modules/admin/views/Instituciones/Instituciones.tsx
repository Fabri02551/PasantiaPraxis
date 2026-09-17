import { useState, useMemo } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { MapPicker } from '../../components/MapPicker/MapPicker'
import './Instituciones.css'
import '../Visitadores/Visitadores.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow })

type Institucion = {
  id: string
  nombre: string
  descripcion: string
  direccion: string
  detalleUbicacion: string
  telefono: string
  email: string
  coords: [number, number]
}

const INITIAL: Institucion[] = []

export const InstitucionesView: React.FC<{ currentView: AdminView; onNavigate: (v: AdminView) => void; onLogout: () => void }> = ({ currentView, onNavigate, onLogout }) => {
  const [instituciones, setInstituciones] = useState<Institucion[]>(INITIAL)
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<Institucion | null>(null)
  const [editing, setEditing] = useState<Institucion | null>(null)
  const [editForm, setEditForm] = useState<Institucion | null>(null)
  const [deleting, setDeleting] = useState<Institucion | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<Omit<Institucion, 'id'>>({ nombre: '', descripcion: '', direccion: '', detalleUbicacion: '', telefono: '', email: '', coords: [-0.1807, -78.4678] })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return instituciones
    return instituciones.filter(i => i.nombre.toLowerCase().includes(q) || i.direccion.toLowerCase().includes(q) || i.descripcion.toLowerCase().includes(q))
  }, [instituciones, search])

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setInstituciones(prev => [...prev, { id: String(Date.now()), ...form }])
    setForm({ nombre: '', descripcion: '', direccion: '', detalleUbicacion: '', telefono: '', email: '', coords: [-0.1807, -78.4678] })
    setShowCreate(false)
  }

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm) return
    setInstituciones(prev => prev.map(i => (i.id === editForm.id ? editForm : i)))
    setEditing(null)
    setEditForm(null)
  }

  return (
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Instituciones" searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar institución...">
      <div className="pruebas-head">
        <div>
          <h2 className="pruebas-title">Instituciones Registradas</h2>
          <p className="pruebas-sub">Gestiona clínicas, hospitales y sedes asociadas a Praxis.</p>
        </div>
        <button className="btn-registrar" onClick={() => setShowCreate(true)}>+ Nueva Institución</button>
      </div>

      <div className="pruebas-card">
        <div className="pruebas-table-wrap">
          <table className="pruebas-table">
            <thead>
              <tr>
                <th>Institución</th>
                <th>Dirección</th>
                <th>Teléfono</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inst => (
                <tr key={inst.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{inst.nombre}</span>
                      <span style={{ fontSize: 11, color: '#7e8aa6' }}>{inst.email}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 11.5, color: '#6b7a99' }}>{inst.direccion}</td>
                  <td style={{ fontSize: 11.5 }}>{inst.telefono}</td>
                  <td>
                    <div className="pruebas-actions">
                      <button className="vt-btn vt-btn--ver" onClick={() => setViewing(inst)}>Ver</button>
                      <button className="vt-btn vt-btn--editar" onClick={() => { setEditing(inst); setEditForm({ ...inst }) }}>Editar</button>
                      <button className="vt-btn vt-btn--eliminar" onClick={() => setDeleting(inst)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#7e8aa6' }}>{instituciones.length === 0 ? 'Sin instituciones - sin datos en BD' : 'Sin resultados.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <div className="vt-overlay" onClick={() => setViewing(null)}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal style={{ maxWidth: 560 }}>
            <div className="vt-modal-head"><h3>{viewing.nombre}</h3><button className="vt-modal-close" onClick={() => setViewing(null)} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <div className="vt-view-body" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, color: '#1B2A4E', margin: 0, lineHeight: 1.5 }}>{viewing.descripcion}</p>
              <div className="vt-view-grid">
                <span>Dirección</span><strong>{viewing.direccion}</strong>
                <span>Detalle</span><strong>{viewing.detalleUbicacion || '—'}</strong>
                <span>Teléfono</span><strong>{viewing.telefono}</strong>
                <span>Email</span><strong>{viewing.email}</strong>
              </div>
              <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e8ecf1' }}>
                <MapContainer center={viewing.coords} zoom={14} scrollWheelZoom={false} zoomControl={false} style={{ height: 200, width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
                  <Marker position={viewing.coords} />
                </MapContainer>
              </div>
              <a href={`https://www.openstreetmap.org/?mlat=${viewing.coords[0]}&mlon=${viewing.coords[1]}#map=14/${viewing.coords[0]}/${viewing.coords[1]}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#2d9c9c', fontWeight: 600, textDecoration: 'none' }}>Abrir en OpenStreetMap ↗</a>
              <button className="vt-btn-submit" style={{ width: '100%' }} onClick={() => setViewing(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="vt-overlay" onClick={() => setShowCreate(false)}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head"><h3>Nueva Institución</h3><button className="vt-modal-close" onClick={() => setShowCreate(false)} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleCreate} className="vt-form">
              <label>Nombre<input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre institución" /></label>
              <label>Descripción<textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción breve" /></label>
              <label>Dirección<input required value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Dirección completa" /></label>
              <label>Detalle de la ubicación<input value={form.detalleUbicacion} onChange={e => setForm({ ...form, detalleUbicacion: e.target.value })} placeholder="Ej. Torre A, 3er piso" /></label>
              <label>Ubicación en mapa — agrega pin
                <MapPicker coords={form.coords} onChange={c => setForm({ ...form, coords: c })} height={160} />
              </label>
              <label>Teléfono<input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></label>
              <label>Email<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
              <div className="vt-form-actions"><button type="button" className="vt-btn-cancel" onClick={() => setShowCreate(false)}>Cancelar</button><button type="submit" className="vt-btn-submit">Registrar</button></div>
            </form>
          </div>
        </div>
      )}

      {editing && editForm && (
        <div className="vt-overlay" onClick={() => { setEditing(null); setEditForm(null) }}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head"><h3>Editar Institución</h3><button className="vt-modal-close" onClick={() => { setEditing(null); setEditForm(null) }} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleEditSave} className="vt-form">
              <label>Nombre<input required value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} /></label>
              <label>Descripción<textarea value={editForm.descripcion} onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })} /></label>
              <label>Dirección<input value={editForm.direccion} onChange={e => setEditForm({ ...editForm, direccion: e.target.value })} /></label>
              <label>Detalle de la ubicación<input value={editForm.detalleUbicacion} onChange={e => setEditForm({ ...editForm, detalleUbicacion: e.target.value })} /></label>
              <label>Ubicación en mapa — agrega pin
                <MapPicker coords={editForm.coords} onChange={c => setEditForm({ ...editForm, coords: c } as Institucion)} height={160} />
              </label>
              <label>Teléfono<input value={editForm.telefono} onChange={e => setEditForm({ ...editForm, telefono: e.target.value })} /></label>
              <label>Email<input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></label>
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
              <div className="vt-delete-icon--minimal">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#8a9ab5" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="M12 8v6" /><circle cx="12" cy="16" r="0.8" fill="#8a9ab5" stroke="none" /></svg>
              </div>
              <p>¿Eliminar <strong>{deleting.nombre}</strong>?</p>
              <p className="vt-delete-hint">Acción visual por el momento.</p>
              <div className="vt-form-actions"><button className="vt-btn-cancel" onClick={() => setDeleting(null)}>Cancelar</button><button className="vt-btn vt-btn--eliminar" onClick={() => { setInstituciones(prev => prev.filter(i => i.id !== deleting.id)); setDeleting(null) }}>Eliminar</button></div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
