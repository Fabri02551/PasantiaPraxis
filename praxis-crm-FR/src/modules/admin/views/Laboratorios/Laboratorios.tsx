import { useState, useMemo, useEffect } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { laboratorioService, type LaboratorioBE, type CostoCiudad } from '../../../core/services/laboratorio.service'
import { ENV } from '../../../core/config/env'
import { Paginador } from '../../../core/components/Paginador/Paginador'
import './Laboratorios.css'
import '../Visitadores/Visitadores.css'

type Prueba = {
  id: number
  codigo: string
  clave: string
  tipo: string
  departamento: string
  precioCompra: number
  comisionExtra: number
  costosCiudad: CostoCiudad[]
}

const parseCostos = (raw: LaboratorioBE['costos_ciudad']): CostoCiudad[] => {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const p: unknown = JSON.parse(raw)
      return Array.isArray(p) ? (p as CostoCiudad[]) : []
    } catch {
      return []
    }
  }
  return []
}

const mapBEtoFE = (b: LaboratorioBE): Prueba => ({
  id: b.id,
  codigo: `LAB-${b.id}`,
  clave: b.clave ?? '',
  tipo: b.nombre,
  departamento: b.area || 'Sin área',
  precioCompra: Number(b.precio) || 0,
  comisionExtra: Number(b.comision_extra) || 0,
  costosCiudad: parseCostos(b.costos_ciudad),
})

const INITIAL: Prueba[] = []

export const LaboratoriosView: React.FC<{ currentView: AdminView; onNavigate: (v: AdminView) => void; onLogout: () => void }> = ({ currentView, onNavigate, onLogout }) => {
  const [pruebas, setPruebas] = useState<Prueba[]>(INITIAL)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15
  const [apiStatus, setApiStatus] = useState<string>(`API: ${ENV.API_URL}`)
  const [viewing, setViewing] = useState<Prueba | null>(null)
  const [editing, setEditing] = useState<Prueba | null>(null)
  const [editForm, setEditForm] = useState<Prueba | null>(null)
  const [deleting, setDeleting] = useState<Prueba | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<Omit<Prueba, 'id' | 'codigo' | 'costosCiudad'>>({ clave: '', tipo: '', departamento: '', precioCompra: 0, comisionExtra: 0 })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    laboratorioService
      .list()
      .then((data) => {
        if (cancelled) return
        const rows = Array.isArray(data) ? data.map(mapBEtoFE) : []
        setPruebas(rows)
        setApiStatus(`Conectado a ${ENV.API_URL} — ${rows.length} estudios desde /api/laboratorios`)
      })
      .catch((err) => {
        console.warn('[Laboratorios] API no disponible', err)
        if (cancelled) return
        setPruebas([])
        setApiStatus(`Error: sin conexión a ${ENV.API_URL} — ${err instanceof Error ? err.message : 'no se pudo cargar laboratorios'}`)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return pruebas
    return pruebas.filter(
      p =>
        p.codigo.toLowerCase().includes(q) ||
        p.clave.toLowerCase().includes(q) ||
        p.tipo.toLowerCase().includes(q) ||
        p.departamento.toLowerCase().includes(q),
    )
  }, [pruebas, search])

  useEffect(() => {
    setPage(1)
  }, [search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const pagedPruebas = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.tipo.trim()) return
    try {
      const created = await laboratorioService.create({
        nombre: form.tipo.trim(),
        area: form.departamento.trim() || 'SIN AREA',
        clave: form.clave.trim() || undefined,
        precio: Number(form.precioCompra) || 0,
        comision_extra: Number(form.comisionExtra) || 0,
      })
      setPruebas(prev => [...prev, mapBEtoFE(created)])
      setApiStatus(`Creado en ${ENV.API_URL} → ${created.nombre}`)
      setForm({ clave: '', tipo: '', departamento: '', precioCompra: 0, comisionExtra: 0 })
      setShowCreate(false)
    } catch (err) {
      console.warn('[Laboratorios] create error', err)
      setApiStatus(`Error al crear estudio: ${err instanceof Error ? err.message : String(err)} — no se guardó (solo DB)`)
    }
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm) return
    try {
      const updated = await laboratorioService.update(editForm.id, {
        nombre: editForm.tipo.trim(),
        area: editForm.departamento.trim() || 'SIN AREA',
        precio: Number(editForm.precioCompra) || 0,
        comision_extra: Number(editForm.comisionExtra) || 0,
      })
      const mapped = mapBEtoFE(updated)
      setPruebas(prev => prev.map(p => (p.id === mapped.id ? mapped : p)))
      setApiStatus(`Actualizado en API: ${mapped.tipo}`)
      setEditing(null)
      setEditForm(null)
    } catch (err) {
      console.warn('[Laboratorios] update error', err)
      setApiStatus(`Error al actualizar: ${err instanceof Error ? err.message : String(err)} — no se guardó (solo DB)`)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await laboratorioService.remove(deleting.id)
      setPruebas(prev => prev.filter(p => p.id !== deleting.id))
      setApiStatus(`Eliminado en API: ${deleting.tipo}`)
      setDeleting(null)
    } catch (err) {
      console.warn('[Laboratorios] delete error', err)
      setApiStatus(`Error al eliminar: ${err instanceof Error ? err.message : String(err)} — no se eliminó (solo DB)`)
    }
  }

  return (
      <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Laboratorio" searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar por nombre, clave o área...">
      <div className="pruebas-head">
        <div>
          <h2 className="pruebas-title">Lista de Precios — Laboratorio</h2>
          <p className="pruebas-sub">Administra catálogo de estudios, códigos y precio de compra.</p>
          <div style={{ fontSize: 11, color: loading ? '#2d9c9c' : '#6b7a99', margin: '6px 0 8px', fontWeight: 500 }}>
            {loading ? 'Cargando desde API...' : apiStatus}
          </div>
        </div>
        <button className="btn-registrar" onClick={() => setShowCreate(true)}>+ Nuevo Tipo</button>
      </div>

      <div className="pruebas-card">
        <div className="pruebas-table-wrap">
          <table className="pruebas-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Clave</th>
                <th>Tipo de Prueba</th>
                <th>Departamento</th>
                <th>Precio Compra</th>
                <th>Comisión Extra</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagedPruebas.map(p => (
                <tr key={p.id}>
                  <td><span className="pruebas-codigo">{p.codigo}</span></td>
                  <td>{p.clave ? <span className="pruebas-codigo">{p.clave}</span> : <span style={{ color: '#8a9ab5' }}>—</span>}</td>
                  <td className="pruebas-tipo">{p.tipo}</td>
                  <td><span className="pruebas-depto">{p.departamento}</span></td>
                  <td className="pruebas-precio">Bs. {p.precioCompra.toFixed(2)}</td>
                  <td className="pruebas-precio">Bs. {p.comisionExtra.toFixed(2)}</td>
                  <td>
                    <div className="pruebas-actions">
                      <button className="vt-btn vt-btn--ver" onClick={() => setViewing(p)}>Ver</button>
                      <button className="vt-btn vt-btn--editar" onClick={() => { setEditing(p); setEditForm({ ...p }) }}>Editar</button>
                      <button className="vt-btn vt-btn--eliminar" onClick={() => setDeleting(p)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#7e8aa6' }}>{loading ? 'Cargando...' : pruebas.length === 0 ? 'Sin pruebas - sin datos en BD' : 'Sin resultados.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid #e8ecf1' }}>
          <span style={{ fontSize: 11, color: '#6b7a99', fontWeight: 600 }}>
            {filtered.length} {filtered.length === 1 ? 'estudio' : 'estudios'}
          </span>
          <Paginador page={page} totalPages={totalPages} onPage={setPage} />
        </div>
      </div>

      {viewing && (
        <div className="vt-overlay" onClick={() => setViewing(null)}>
          <div className="vt-modal vt-modal--sm" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head"><h3>Detalle de Prueba</h3><button className="vt-modal-close" onClick={() => setViewing(null)} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <div className="vt-view-body" style={{ textAlign: 'left' }}>
              <div className="vt-view-grid">
                <span>Código</span><strong>{viewing.codigo}</strong>
                <span>Clave</span><strong>{viewing.clave || '—'}</strong>
                <span>Tipo</span><strong>{viewing.tipo}</strong>
                <span>Departamento</span><strong>{viewing.departamento}</strong>
                <span>Precio Compra</span><strong>Bs. {viewing.precioCompra.toFixed(2)}</strong>
                <span>Comisión Extra</span><strong>Bs. {viewing.comisionExtra.toFixed(2)}</strong>
              </div>
              {viewing.costosCiudad.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E', margin: '0 0 6px' }}>Costo por ciudad</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {viewing.costosCiudad.map(c => (
                      <div key={c.ciudad_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                        <span style={{ color: '#6b7a99' }}>{c.ciudad}</span>
                        <strong>Bs. {Number(c.costo).toFixed(2)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
              <label>Tipo de Prueba <span style={{ color: '#8a9ab5', fontSize: 10 }}>* obligatorio — backend: nombre</span><input required value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} placeholder="Nombre del estudio" /></label>
              <label>Clave <span style={{ color: '#8a9ab5', fontSize: 10 }}>(opcional — backend: clave; solo al crear)</span><input value={form.clave} onChange={e => setForm({ ...form, clave: e.target.value })} placeholder="Ej. HEM-001" maxLength={50} /></label>
              <label>Departamento <span style={{ color: '#8a9ab5', fontSize: 10 }}>(opcional — backend: area)</span><input value={form.departamento} onChange={e => setForm({ ...form, departamento: e.target.value })} placeholder="Ej. Inmunología" /></label>
              <label>Precio Compra (Bs.) <span style={{ color: '#8a9ab5', fontSize: 10 }}>(backend: precio)</span><input type="number" step="0.01" min={0} value={form.precioCompra} onChange={e => setForm({ ...form, precioCompra: Number(e.target.value) })} /></label>
              <label>Comisión Extra (Bs.) <span style={{ color: '#8a9ab5', fontSize: 10 }}>(backend: comision_extra)</span><input type="number" step="0.01" min={0} value={form.comisionExtra} onChange={e => setForm({ ...form, comisionExtra: Number(e.target.value) })} /></label>
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
              <label>Código<input value={editForm.codigo} disabled /></label>
              <label>Clave <span style={{ color: '#8a9ab5', fontSize: 10 }}>(no editable)</span><input value={editForm.clave} disabled /></label>
              <label>Tipo de Prueba<input required value={editForm.tipo} onChange={e => setEditForm({ ...editForm, tipo: e.target.value })} /></label>
              <label>Departamento<input value={editForm.departamento} onChange={e => setEditForm({ ...editForm, departamento: e.target.value })} /></label>
              <label>Precio Compra (Bs.)<input type="number" step="0.01" min={0} value={editForm.precioCompra} onChange={e => setEditForm({ ...editForm, precioCompra: Number(e.target.value) })} /></label>
              <label>Comisión Extra (Bs.)<input type="number" step="0.01" min={0} value={editForm.comisionExtra} onChange={e => setEditForm({ ...editForm, comisionExtra: Number(e.target.value) })} /></label>
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
              <p className="vt-delete-hint">Se desactiva en la base de datos.</p>
              <div className="vt-form-actions"><button className="vt-btn-cancel" onClick={() => setDeleting(null)}>Cancelar</button><button className="vt-btn vt-btn--eliminar" onClick={handleDelete}>Eliminar</button></div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
