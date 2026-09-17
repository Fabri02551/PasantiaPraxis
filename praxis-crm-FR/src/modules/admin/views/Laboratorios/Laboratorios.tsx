import { useState, useMemo } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import './Laboratorios.css'
import '../Visitadores/Visitadores.css'

type Prueba = {
  id: string
  codigo: string
  tipo: string
  departamento: string
  precioCompra: number
}

const INITIAL: Prueba[] = []

export const LaboratoriosView: React.FC<{ currentView: AdminView; onNavigate: (v: AdminView) => void; onLogout: () => void }> = ({ currentView, onNavigate, onLogout }) => {
  const [pruebas, setPruebas] = useState<Prueba[]>(INITIAL)
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<Prueba | null>(null)
  const [editing, setEditing] = useState<Prueba | null>(null)
  const [editForm, setEditForm] = useState<Prueba | null>(null)
  const [deleting, setDeleting] = useState<Prueba | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<Omit<Prueba, 'id'>>({ codigo: '', tipo: '', departamento: '', precioCompra: 0 })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return pruebas
    return pruebas.filter(p => p.codigo.toLowerCase().includes(q) || p.tipo.toLowerCase().includes(q) || p.departamento.toLowerCase().includes(q))
  }, [pruebas, search])

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.codigo.trim() || !form.tipo.trim()) return
    const nuevo: Prueba = { id: String(Date.now()), ...form, codigo: form.codigo.trim().toUpperCase(), tipo: form.tipo.trim(), departamento: form.departamento.trim() }
    setPruebas(prev => [...prev, nuevo])
    setForm({ codigo: '', tipo: '', departamento: '', precioCompra: 0 })
    setShowCreate(false)
  }

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm) return
    setPruebas(prev => prev.map(p => (p.id === editForm.id ? editForm : p)))
    setEditing(null)
    setEditForm(null)
  }

  return (
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Laboratorio" searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar por código o estudio...">
      <div className="pruebas-head">
        <div>
          <h2 className="pruebas-title">Lista de Precios — Laboratorio</h2>
          <p className="pruebas-sub">Administra catálogo de estudios, códigos y precio de compra.</p>
        </div>
        <button className="btn-registrar" onClick={() => setShowCreate(true)}>+ Nuevo Tipo</button>
      </div>

      <div className="pruebas-card">
        <div className="pruebas-table-wrap">
          <table className="pruebas-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Tipo de Prueba</th>
                <th>Departamento</th>
                <th>Precio Compra</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td><span className="pruebas-codigo">{p.codigo}</span></td>
                  <td className="pruebas-tipo">{p.tipo}</td>
                  <td><span className="pruebas-depto">{p.departamento}</span></td>
                  <td className="pruebas-precio">Bs. {p.precioCompra.toFixed(2)}</td>
                  <td>
                    <div className="pruebas-actions">
                      <button className="vt-btn vt-btn--ver" onClick={() => setViewing(p)}>Ver</button>
                      <button className="vt-btn vt-btn--editar" onClick={() => { setEditing(p); setEditForm({ ...p }) }}>Editar</button>
                      <button className="vt-btn vt-btn--eliminar" onClick={() => setDeleting(p)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: '#7e8aa6' }}>{pruebas.length === 0 ? 'Sin pruebas - sin datos en BD' : 'Sin resultados.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <div className="vt-overlay" onClick={() => setViewing(null)}>
          <div className="vt-modal vt-modal--sm" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head"><h3>Detalle de Prueba</h3><button className="vt-modal-close" onClick={() => setViewing(null)} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <div className="vt-view-body" style={{ textAlign: 'left' }}>
              <div className="vt-view-grid">
                <span>Código</span><strong>{viewing.codigo}</strong>
                <span>Tipo</span><strong>{viewing.tipo}</strong>
                <span>Departamento</span><strong>{viewing.departamento}</strong>
                <span>Precio Compra</span><strong>Bs. {viewing.precioCompra.toFixed(2)}</strong>
              </div>
              <button className="vt-btn-submit" style={{ width: '100%', marginTop: 16 }} onClick={() => setViewing(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="vt-overlay" onClick={() => setShowCreate(false)}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head"><h3>Nuevo Tipo de Prueba</h3><button className="vt-modal-close" onClick={() => setShowCreate(false)} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleCreate} className="vt-form">
              <label>Código<input required value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="Ej. CU147" /></label>
              <label>Tipo de Prueba<input required value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} placeholder="Nombre del estudio" /></label>
              <label>Departamento<input value={form.departamento} onChange={e => setForm({ ...form, departamento: e.target.value })} placeholder="Ej. Inmunología" /></label>
              <label>Precio Compra<input type="number" step="0.01" min={0} value={form.precioCompra} onChange={e => setForm({ ...form, precioCompra: Number(e.target.value) })} /></label>
              <div className="vt-form-actions"><button type="button" className="vt-btn-cancel" onClick={() => setShowCreate(false)}>Cancelar</button><button type="submit" className="vt-btn-submit">Registrar</button></div>
            </form>
          </div>
        </div>
      )}

      {editing && editForm && (
        <div className="vt-overlay" onClick={() => { setEditing(null); setEditForm(null) }}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head"><h3>Editar Prueba</h3><button className="vt-modal-close" onClick={() => { setEditing(null); setEditForm(null) }} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleEditSave} className="vt-form">
              <label>Código<input required value={editForm.codigo} onChange={e => setEditForm({ ...editForm, codigo: e.target.value })} /></label>
              <label>Tipo de Prueba<input required value={editForm.tipo} onChange={e => setEditForm({ ...editForm, tipo: e.target.value })} /></label>
              <label>Departamento<input value={editForm.departamento} onChange={e => setEditForm({ ...editForm, departamento: e.target.value })} /></label>
              <label>Precio Compra<input type="number" step="0.01" min={0} value={editForm.precioCompra} onChange={e => setEditForm({ ...editForm, precioCompra: Number(e.target.value) })} /></label>
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
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#8a9ab5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v6" />
                  <circle cx="12" cy="16" r="0.8" fill="#8a9ab5" stroke="none" />
                </svg>
              </div>
              <p>¿Eliminar <strong>{deleting.tipo}</strong> ({deleting.codigo})?</p>
              <p className="vt-delete-hint">Esta acción es visual por el momento.</p>
              <div className="vt-form-actions"><button className="vt-btn-cancel" onClick={() => setDeleting(null)}>Cancelar</button><button className="vt-btn vt-btn--eliminar" onClick={() => { setPruebas(prev => prev.filter(p => p.id !== deleting.id)); setDeleting(null) }}>Eliminar</button></div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
