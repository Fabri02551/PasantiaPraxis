import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { medicoService } from '../../../core/services/medico.service'
import { personaService } from '../../../core/services/persona.service'
import { especialidadService, type Especialidad } from '../../../core/services/especialidad.service'
import { ENV } from '../../../core/config/env'
import { MapPicker } from '../../../admin/components/MapPicker/MapPicker'
import { displayMedico } from '../../../core/utils/medicoPrefix'
import { normalizeUbicaciones, hospitalFromDireccion, type UbicacionMedico } from '../../../core/utils/medicoDireccion'
import { Toast } from '../../../core/components/Toast/Toast'
import './Medicos.css'
import '../../../admin/views/Visitadores/Visitadores.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

type Ubicacion = UbicacionMedico

export type Medico = {
  id: string
  nombre: string
  primerApellido?: string
  segundoApellido?: string
  sexo?: string
  matricula?: string
  especialidad: string
  hospital: string
  visitadorAsignado: string | null
  ubicaciones?: Ubicacion[]
}

export const MEDICOS: Medico[] = []

const reqStyle: React.CSSProperties = { color: '#8a9ab5', fontWeight: 400, fontSize: 10, opacity: 0.85, marginLeft: 4, textTransform: 'lowercase' }
const optStyle: React.CSSProperties = { color: '#8a9ab5', fontWeight: 400, fontSize: 10, opacity: 0.75, marginLeft: 4, textTransform: 'lowercase' }

export const MedicosView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Medico | null>(null)
  const [medicos, setMedicos] = useState<Medico[]>([])
  const [apiStatus, setApiStatus] = useState(`API: ${ENV.API_URL}`)
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  // Ref, no solo state: setSaving(true) no actualiza `saving` hasta el
  // siguiente render, así que dos clics rápidos aún pasarían la validación.
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)
  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])
  const [form, setForm] = useState({
    nombre: '', primerApellido: '', segundoApellido: '', sexo: '', matricula: '',
    especialidad: '', hospital: '', telefono: '', email: '', ci: '', descripcion: '',
    ubicaciones: [{ id: 'u0', direccion: '', detalle: '', coords: [-0.1807, -78.4678] as [number, number] }],
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    medicoService
      .list()
      .then(async (data) => {
        if (cancelled) return
        if (Array.isArray(data) && data.length > 0) {
          const mapped: Medico[] = await Promise.all(data.map(async (b) => {
            let nombre = `Médico ${b.matricula || b.persona_id}`
            let primerApellido = ''
            let segundoApellido = ''
            let sexo: string | undefined
            try {
              const p = await personaService.getById(b.persona_id)
              nombre = p.nombre || nombre
              primerApellido = p.primer_apellido || ''
              segundoApellido = p.segundo_apellido || ''
              sexo = p.sexo || undefined
            } catch { /* fallback */ }
            return {
              id: String(b.persona_id),
              nombre,
              primerApellido,
              segundoApellido,
              sexo,
              matricula: b.matricula || '',
              especialidad: String(b.especialidad_id ?? 'General'),
              hospital: hospitalFromDireccion(b.direccion) || 'Sin institución',
              visitadorAsignado: null,
              ubicaciones: normalizeUbicaciones(b.direccion),
            }
          }))
          if (cancelled) return
          setMedicos(mapped)
          setApiStatus(`Conectado a ${ENV.API_URL} — ${data.length} médicos desde /api/medicos`)
        } else {
          setMedicos([])
          setApiStatus(`Conectado a ${ENV.API_URL} — sin datos`)
        }
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[Medicos] API no disponible', err)
        setMedicos([])
        setApiStatus(`Sin conexión a ${ENV.API_URL}`)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
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
    return medicos.filter(
      (m) => displayMedico(m.sexo, `${m.nombre} ${m.primerApellido || ''}`.trim()).toLowerCase().includes(q) || m.especialidad.toLowerCase().includes(q) || m.hospital.toLowerCase().includes(q),
    )
  }, [search, medicos])

  const nombreCompleto = (m: Medico) => `${m.nombre} ${m.primerApellido || ''}${m.segundoApellido ? ' ' + m.segundoApellido : ''}`.trim()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (savingRef.current) return
    if (!form.nombre.trim() || !form.primerApellido.trim()) {
      showToast('Nombre y primer apellido son obligatorios', 'error')
      return
    }
    if (!form.matricula.trim()) {
      showToast('La matrícula es obligatoria', 'error')
      return
    }
    if (!form.especialidad) {
      showToast('La especialidad es obligatoria', 'error')
      return
    }
    if (!form.sexo) {
      showToast('El sexo es obligatorio', 'error')
      return
    }

    const ubicaciones = form.ubicaciones.filter(u => u.direccion.trim() || u.detalle.trim())
    const matricula = form.matricula.trim()
    savingRef.current = true
    setSaving(true)
    try {
      // Un solo POST: el backend inserta persona + medico en una transacción.
      const created = await medicoService.create({
        matricula,
        especialidad_id: Number(form.especialidad),
        persona: {
          nombre: form.nombre.trim(),
          primer_apellido: form.primerApellido.trim(),
          segundo_apellido: form.segundoApellido.trim(),
          sexo: form.sexo,
          correo: form.email.trim(),
          telefono: form.telefono.trim(),
          ci: form.ci.trim(),
        },
        direccion: ubicaciones,
        notas: form.descripcion.trim() ? { descripcion: form.descripcion.trim() } : undefined,
      })
      const row: Medico = {
        id: String(created.persona_id),
        nombre: form.nombre.trim(),
        primerApellido: form.primerApellido.trim(),
        segundoApellido: form.segundoApellido.trim(),
        sexo: form.sexo,
        matricula,
        especialidad: (especialidades ?? []).find(es => String(es.id) === form.especialidad)?.nombre || form.especialidad,
        hospital: hospitalFromDireccion(ubicaciones) || 'Sin institución',
        visitadorAsignado: null,
        ubicaciones: ubicaciones.length > 0 ? ubicaciones : form.ubicaciones,
      }
      setMedicos(prev => [...prev, row])
      setApiStatus(`Creado en API: ${displayMedico(row.sexo, nombreCompleto(row))} (${matricula})`)
      showToast(`Médico registrado ✓ ${row.nombre} ${row.primerApellido} · ${matricula}`, 'success')
      setForm({ nombre: '', primerApellido: '', segundoApellido: '', sexo: '', matricula: '', especialidad: '', hospital: '', telefono: '', email: '', ci: '', descripcion: '', ubicaciones: [{ id: 'u0', direccion: '', detalle: '', coords: [-0.1807, -78.4678] }] })
      setShowCreate(false)
    } catch (err) {
      console.warn('[Medicos] create error', err)
      const msg = err instanceof Error ? err.message : String(err)
      setApiStatus(`Error al crear médico: ${msg}`)
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
        <h1 className="header-title">Médicos</h1>
        <button className="icon-btn notification-btn" aria-label="Notificaciones" onClick={() => onNavigate('notificaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate as any} currentView={currentView as any} onLogout={onLogout} />

      <div className="medicos-content">
        <div style={{ fontSize: 11, color: loading ? '#2d9c9c' : '#6b7a99', margin: '0 0 8px', fontWeight: 500 }}>{loading ? 'Cargando...' : apiStatus}</div>
        <div className="medicos-search-wrap">
          <svg className="medicos-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a9ab5" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            className="medicos-search-input"
            placeholder="Buscar médico o especialidad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="medicos-subheader">
          <span className="medicos-subtitle">Todos los médicos registrados</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="medicos-count">{filtered.length} resultados</span>
            <button className="vt-btn vt-btn--ver" style={{ height: 28, borderRadius: 8, fontSize: 11, fontWeight: 700 }} onClick={() => setShowCreate(true)}>+ Nuevo Médico</button>
          </div>
        </div>

        <ul className="medicos-list">
          {filtered.map((m) => (
            <li key={m.id} className="medico-card" onClick={() => setSelected(m)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelected(m)} style={{ cursor: 'pointer' }}>
              <div className="medico-info">
                <span className="medico-nombre">{displayMedico(m.sexo, nombreCompleto(m))}</span>
                <span className="medico-especialidad">{m.especialidad ? ((especialidades ?? []).find(es => String(es.id) === m.especialidad)?.nombre || m.especialidad) : m.especialidad}</span>
                <span className="medico-hospital">
                  <span className="medico-hospital-dot" />
                  {m.hospital}
                </span>
                <span className={`medico-visitador ${m.visitadorAsignado ? 'asignado' : 'no-asignado'}`}>
                  {m.visitadorAsignado ? `Visitador: ${m.visitadorAsignado}` : 'Sin visitador asignado'}
                </span>
              </div>
              <span className="medico-chevron">›</span>
            </li>
          ))}
        </ul>

        {!loading && filtered.length === 0 && (
          <p className="medicos-empty">{medicos.length === 0 ? 'No hay médicos registrados en la base de datos' : 'No se encontraron médicos'}</p>
        )}

        {selected && (
          <div className="medico-detail-overlay" onClick={() => setSelected(null)}>
            <div className="medico-detail-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="medico-detail-header">
                <h3>{displayMedico(selected.sexo, nombreCompleto(selected))}</h3>
                <button className="medico-detail-close" onClick={() => setSelected(null)} aria-label="Cerrar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="medico-detail-esp">{selected.especialidad ? ((especialidades ?? []).find(es => String(es.id) === selected.especialidad)?.nombre || selected.especialidad) : selected.especialidad} · {selected.hospital}</p>
              <div className={`medico-detail-asignado ${selected.visitadorAsignado ? 'asignado' : 'no-asignado'}`}>
                {selected.visitadorAsignado ? `✓ Visitador asignado: ${selected.visitadorAsignado}` : '○ Sin visitador asignado'}
              </div>
              <button className="medico-detail-primary" onClick={() => setSelected(null)}>Cerrar</button>
            </div>
          </div>
        )}

        {showCreate && (
          <div className="vt-overlay" onClick={() => { if (!savingRef.current) setShowCreate(false) }} style={{ zIndex: 3000 }}>
            <div className="vt-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="vt-modal-head"><h3>Nuevo Médico</h3><button className="vt-modal-close" onClick={() => setShowCreate(false)} aria-label="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
              <form onSubmit={handleCreate} className="vt-form">
                <label>Nombre <span style={reqStyle}>* obligatorio</span><input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Juan" /></label>
                <label>Primer Apellido <span style={reqStyle}>* obligatorio</span><input required value={form.primerApellido} onChange={e => setForm({ ...form, primerApellido: e.target.value })} placeholder="Ej. Pérez" /></label>
                <label>Segundo Apellido <span style={optStyle}>(opcional)</span><input value={form.segundoApellido} onChange={e => setForm({ ...form, segundoApellido: e.target.value })} placeholder="Ej. López" /></label>
                <label>Sexo <span style={reqStyle}>* obligatorio</span>
                  <select required value={form.sexo} onChange={e => setForm({ ...form, sexo: e.target.value })}>
                    <option value="">Seleccione sexo</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                  </select>
                </label>
                <label>Matrícula <span style={reqStyle}>* obligatorio</span><input required value={form.matricula} onChange={e => setForm({ ...form, matricula: e.target.value })} placeholder="MED-12345" /></label>
                <label>Especialidad <span style={reqStyle}>* obligatorio</span>
                  <select required value={form.especialidad} onChange={e => setForm({ ...form, especialidad: e.target.value })}>
                    <option value="">Seleccione especialidad</option>
                    {(especialidades ?? []).map(es => <option key={es.id} value={String(es.id)}>{es.nombre} ({es.codigo})</option>)}
                  </select>
                </label>
                <label>Teléfono <span style={optStyle}>(opcional)</span><input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="0999999999" /></label>
                <label>Correo / Email <span style={optStyle}>(opcional)</span><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ejemplo@correo.com" /></label>
                <label>CI <span style={optStyle}>(opcional)</span><input value={form.ci} onChange={e => setForm({ ...form, ci: e.target.value })} placeholder="1712345678" /></label>
                <label>Descripción / Notas <span style={optStyle}>(opcional)</span><textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Notas" /></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E' }}>Ubicaciones</span>
                  {form.ubicaciones.map((u, idx) => (
                    <div key={u.id} style={{ border: '1px solid #e8ecf1', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: '#fcfcfd' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E' }}>Ubicación {idx + 1}</span>
                        <button type="button" className="vt-btn-cancel" onClick={() => setForm({ ...form, ubicaciones: form.ubicaciones.filter((_, i) => i !== idx) })} disabled={form.ubicaciones.length <= 1}>Quitar</button>
                      </div>
                      <label style={{ fontSize: 11, fontWeight: 600 }}>Dirección<input value={u.direccion} onChange={e => setForm({ ...form, ubicaciones: form.ubicaciones.map((x, i) => i === idx ? { ...x, direccion: e.target.value } : x) })} placeholder={`Dirección ${idx + 1}`} /></label>
                      <label style={{ fontSize: 11, fontWeight: 600 }}>Detalle de la ubicación<input value={u.detalle} onChange={e => setForm({ ...form, ubicaciones: form.ubicaciones.map((x, i) => i === idx ? { ...x, detalle: e.target.value } : x) })} placeholder="Ej. Consultorio 301" /></label>
                      <MapPicker coords={u.coords} onChange={c => setForm({ ...form, ubicaciones: form.ubicaciones.map((x, i) => i === idx ? { ...x, coords: c } : x) })} height={140} />
                    </div>
                  ))}
                  <button type="button" className="vt-btn vt-btn--ver" onClick={() => setForm({ ...form, ubicaciones: [...form.ubicaciones, { id: `u${Date.now()}`, direccion: '', detalle: '', coords: [-0.1807, -78.4678] }] })} style={{ alignSelf: 'flex-start' }}>+ Agregar ubicación</button>
                </div>
                <div className="vt-form-actions"><button type="button" className="vt-btn-cancel" onClick={() => setShowCreate(false)} disabled={saving}>Cancelar</button><button type="submit" className="vt-btn-submit" disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</button></div>
              </form>
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
      </div>
    </div>
  )
}

export const VisitadorMedicos = MedicosView
