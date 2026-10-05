import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { Paginador } from '../../../core/components/Paginador/Paginador'
import { institucionService, type InstitucionBE } from '../../../core/services/institucion.service'
import { personaService } from '../../../core/services/persona.service'
import { ciudadService, type Ciudad } from '../../../core/services/ciudad.service'
import { ClasificacionPicker, MiniClasificacion } from '../../../core/components/ClasificacionPicker/ClasificacionPicker'
import { authService } from '../../../auth/services/auth.service'
import { MapPicker } from '../../../admin/components/MapPicker/MapPicker'
import { normalizeUbicaciones, type UbicacionMedico } from '../../../core/utils/medicoDireccion'
import { storage } from '../../../core/lib/storage'
import { Toast } from '../../../core/components/Toast/Toast'
import '../Medicos/Medicos.css'
import '../../../admin/views/Visitadores/Visitadores.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow })

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'instituciones' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

type Ubicacion = UbicacionMedico

type Institucion = {
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

const reqStyle: React.CSSProperties = { color: '#8a9ab5', fontWeight: 400, fontSize: 10, opacity: 0.85, marginLeft: 4, textTransform: 'lowercase' }
const optStyle: React.CSSProperties = { color: '#8a9ab5', fontWeight: 400, fontSize: 10, opacity: 0.75, marginLeft: 4, textTransform: 'lowercase' }

// La ubicación nueva de una institución nace "cerca de quien la está creando",
// igual que en el alta de médicos.
const coordsCercaDeMi = (): [number, number] | null => {
  const u = storage.getUbicacion()
  return u && Number.isFinite(u.latitud) && Number.isFinite(u.longitud) ? [u.latitud, u.longitud] : null
}

const mapBE = (b: InstitucionBE): Institucion => ({
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

export const InstitucionesView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [committedQ, setCommittedQ] = useState('')
  const [selected, setSelected] = useState<Institucion | null>(null)
  const [instituciones, setInstituciones] = useState<Institucion[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [ciudades, setCiudades] = useState<Ciudad[]>([])
  const [miPersonaId, setMiPersonaId] = useState<number | null>(null)
  // Nombre del visitador dueño de la institución en detalle (GET /api/personas/{id}).
  const [visitadorNombre, setVisitadorNombre] = useState<string>('')
  const savingRef = useRef(false)
  const reqRef = useRef(0)
  const PAGE_SIZE = 20
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)
  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])
  const [form, setForm] = useState({
    nombre: '', razonSocial: '', nit: '', tipoContrato: '', telefono: '', correo: '',
    esParticular: true, clasificacion: 1, ciudad: '',
    ubicaciones: [{ id: 'u0' as string, direccion: '', detalle: '', coords: coordsCercaDeMi() as [number, number] | null }],
  })

  useEffect(() => {
    let cancelled = false
    ciudadService.list().then((data) => {
      if (cancelled) return
      setCiudades(Array.isArray(data) ? data.filter(c => c.status !== false) : [])
    }).catch(() => setCiudades([]))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    authService.getMe().then((me) => {
      if (!cancelled && me?.persona_id != null) setMiPersonaId(me.persona_id)
    }).catch(() => { /* sin perfil */ })
    return () => {
      cancelled = true
    }
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
    } catch (err) {
      if (reqRef.current !== reqId) return
      console.warn('[Instituciones] API no disponible', err)
      setInstituciones([])
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
    let cancelled = false
    setVisitadorNombre('')
    if (selected?.visitadorId == null) return
    personaService.getById(selected.visitadorId).then((p) => {
      if (cancelled) return
      setVisitadorNombre(`${p.nombre} ${p.primer_apellido || ''}`.trim())
    }).catch(() => setVisitadorNombre(''))
    return () => {
      cancelled = true
    }
  }, [selected])

  const esMia = (i: Institucion): boolean => (miPersonaId != null && i.visitadorId === miPersonaId)

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
    const ubicaciones = form.ubicaciones.filter(u => u.direccion.trim() || u.detalle.trim())
    savingRef.current = true
    setSaving(true)
    try {
      // Sin visitador_id: el backend le asigna la institución al visitador
      // que la está creando (misma regla que en el alta de médicos).
      const created = await institucionService.create({
        nombre: form.nombre.trim(),
        razon_social: form.razonSocial.trim(),
        nit: form.nit.trim(),
        tipo_contrato: form.tipoContrato.trim(),
        telefono: form.telefono.trim(),
        correo: form.correo.trim(),
        es_particular: form.esParticular,
        clasificacion: form.clasificacion,
        ciudad_id: form.ciudad ? Number(form.ciudad) : null,
        direccion: ubicaciones,
      })
      const row = mapBE(created)
      setSearch('')
      setCommittedQ('')
      load(1, '')
      showToast(`Institución registrada ✓ ${row.nombre}`, 'success')
      setForm({ nombre: '', razonSocial: '', nit: '', tipoContrato: '', telefono: '', correo: '', esParticular: true, clasificacion: 1, ciudad: '', ubicaciones: [{ id: `u${Date.now()}`, direccion: '', detalle: '', coords: coordsCercaDeMi() }] })
      setShowCreate(false)
    } catch (err) {
      console.warn('[Instituciones] create error', err)
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`No se guardó ✗ ${msg}`, 'error')
      setShowCreate(false)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="medicos-page">
      <header className="medicos-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Instituciones</h1>
        <button className="icon-btn notification-btn" aria-label="Notificaciones" onClick={() => onNavigate('notificaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate} currentView={currentView} onLogout={onLogout} />

      <div className="medicos-content">
        {loading && <p style={{ fontSize: 11, color: '#2d9c9c', margin: '0 0 8px', fontWeight: 500 }}>Cargando...</p>}
        <div className="medicos-search-wrap">
          <svg className="medicos-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a9ab5" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            className="medicos-search-input"
            placeholder="Buscar institución, NIT o razón social..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="medicos-subheader">
          <span className="medicos-subtitle">Todas las instituciones registradas</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="medicos-count">{total} resultados</span>
            <button className="vt-btn vt-btn--ver" style={{ height: 28, borderRadius: 8, fontSize: 11, fontWeight: 700 }} onClick={() => setShowCreate(true)}>+ Nueva Institución</button>
          </div>
        </div>

        <ul className="medicos-list">
          {instituciones.map((i) => (
            <li key={i.id} className="medico-card" onClick={() => setSelected(i)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelected(i)} style={{ cursor: 'pointer' }}>
              <div className="medico-info">
                <span className="medico-nombre">{i.nombre}</span>
                <span className="medico-especialidad">{i.razonSocial || i.nit ? (i.razonSocial || `NIT ${i.nit}`) : 'Sin razón social'}</span>
                <span className="medico-hospital">
                  <span className="medico-hospital-dot" />
                  {i.ubicaciones[0]?.direccion || 'Sin dirección registrada'}
                </span>
                <span className={`medico-visitador ${esMia(i) ? 'asignado' : 'no-asignado'}`}>
                  {esMia(i) ? 'Asignada a ti' : (i.visitadorId != null ? 'Asignada a otro visitador' : 'Sin visitador asignado')}
                </span>
              </div>
              <span className="medico-chevron">›</span>
            </li>
          ))}
        </ul>

        <Paginador page={page} totalPages={totalPages} onPage={goPage} loading={loading} />

        {!loading && instituciones.length === 0 && (
          <p className="medicos-empty">{total === 0 ? 'No hay instituciones registradas' : 'No se encontraron instituciones'}</p>
        )}
      </div>

      {selected && (
        <div className="medico-detail-overlay" onClick={() => setSelected(null)}>
          <div className="medico-detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Detalle de ${selected.nombre}`}>
            <div className="medico-detail-header">
              <h3>{selected.nombre}</h3>
              <button className="medico-detail-close" onClick={() => setSelected(null)} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
            </div>
            <span className="medico-detail-esp">{selected.razonSocial || `NIT ${selected.nit || '—'}`}</span>
            <span className={`medico-detail-asignado ${esMia(selected) ? 'asignado' : 'no-asignado'}`}>
              {esMia(selected) ? 'Asignada a ti' : selected.visitadorId != null ? `Visitador: ${visitadorNombre || '—'}` : 'Sin visitador asignado'}
            </span>
            <div className="vt-view-grid" style={{ margin: '12px 0' }}>
              <span>NIT</span><strong>{selected.nit || '—'}</strong>
              <span>Ciudad</span><strong>{(ciudades ?? []).find(c => String(c.id) === selected.ciudad)?.nombre || '—'}</strong>
              <span>Contrato</span><strong>{selected.tipoContrato || '—'}</strong>
              <span>Tipo</span><strong>{selected.esParticular ? 'Particular' : 'No particular'}</strong>
              <span>Clasificación</span><strong><MiniClasificacion valor={selected.clasificacion} /></strong>
              <span>Teléfono</span><strong>{selected.telefono || '—'}</strong>
              <span>Email</span><strong>{selected.correo || '—'}</strong>
            </div>
            <div className="vt-view-grid" style={{ margin: '12px 0' }}>
              {selected.ubicaciones.map((u, idx) => (
                <div key={u.id} style={{ gridColumn: '1 / -1', border: '1px solid #e8ecf1', borderRadius: 10, padding: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E' }}>{idx + 1}. {u.direccion || 'Sin dirección'}</span>
                  {u.detalle && <p style={{ fontSize: 11, color: '#6b7a99', margin: '4px 0' }}>{u.detalle}</p>}
                  {u.coords ? (
                    <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e8ecf1', marginTop: 6 }}>
                      <MapContainer center={u.coords} zoom={14} scrollWheelZoom={false} zoomControl={false} style={{ height: 140, width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
                        <Marker position={u.coords} />
                      </MapContainer>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#7e8aa6', background: '#f8f9fb', borderRadius: 8, padding: 10, border: '1px dashed #dbe2ea', marginTop: 6 }}>
                      Sin coordenadas geocodificadas.
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button className="medico-detail-primary" onClick={() => setSelected(null)}>Cerrar</button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="vt-overlay" onClick={() => { if (!savingRef.current) setShowCreate(false) }}>
          <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal>
            <div className="vt-modal-head"><h3>Nueva Institución</h3><button className="vt-modal-close" onClick={() => setShowCreate(false)} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
            <form onSubmit={handleCreate} className="vt-form">
              <label>Nombre <span style={reqStyle}>* obligatorio</span><input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Clínica Central" /></label>
              <label>Razón Social <span style={optStyle}>(opcional)</span><input value={form.razonSocial} onChange={e => setForm({ ...form, razonSocial: e.target.value })} placeholder="Ej. Clínica Central S.A." /></label>
              <label>NIT <span style={reqStyle}>* obligatorio</span><input required value={form.nit} onChange={e => setForm({ ...form, nit: e.target.value })} placeholder="Ej. 1791234567001" /></label>
              <label>Tipo de Contrato <span style={optStyle}>(opcional)</span><input value={form.tipoContrato} onChange={e => setForm({ ...form, tipoContrato: e.target.value })} placeholder="Ej. convenio, particular…" /></label>
              <label>Ciudad <span style={optStyle}>(opcional)</span>
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
              <label>Teléfono <span style={optStyle}>(opcional)</span><input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="Ej. 02 2555 0000" /></label>
              <label>Correo / Email <span style={optStyle}>(opcional)</span><input type="email" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} placeholder="ejemplo@clinica.com" /></label>
              <div className="vt-form-actions"><button type="button" className="vt-btn-cancel" onClick={() => setShowCreate(false)} disabled={saving}>Cancelar</button><button type="submit" className="vt-btn-submit" disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</button></div>
            </form>
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
    </div>
  )
}