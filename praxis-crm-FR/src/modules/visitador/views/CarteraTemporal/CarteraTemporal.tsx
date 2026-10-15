import { useEffect, useMemo, useRef, useState } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { authService, type CurrentUser } from '../../../auth/services/auth.service'
import { medicoService, type MedicoBE } from '../../../core/services/medico.service'
import { personaService, type Persona } from '../../../core/services/persona.service'
import { especialidadService } from '../../../core/services/especialidad.service'
import { ciudadService } from '../../../core/services/ciudad.service'
import { Toast } from '../../../core/components/Toast/Toast'
import { MapPicker } from '../../../admin/components/MapPicker/MapPicker'
import { displayMedico } from '../../../core/utils/medicoPrefix'
import { hospitalFromDireccion, normalizeUbicaciones, type UbicacionMedico } from '../../../core/utils/medicoDireccion'
import { storage } from '../../../core/lib/storage'
import './CarteraTemporal.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'instituciones' | 'comentarios' | 'historial' | 'cartera' | 'cartera-temporal' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

// Una fila de la cartera: médico + datos de su persona (una sola carga de
// /api/personas en vez de un request por médico).
type MedicoCartera = {
  persona_id: number
  matricula: string
  codigo: string
  especialidad: string
  clasificacion: number
  frecuencia: string
  esParticular: boolean
  notas: string
  fechaCreacion: string
  ultimaModificacion: string
  nombre: string
  primerApellido: string
  segundoApellido: string
  sexo: string
  telefono: string
  email: string
  ci: string
  ciudad: string
  ubicaciones: UbicacionMedico[]
}

const coordsCercaDeMi = (): [number, number] | null => {
  const u = storage.getUbicacion()
  return u && Number.isFinite(u.latitud) && Number.isFinite(u.longitud) ? [u.latitud, u.longitud] : null
}

const descripcionDeNotas = (raw: unknown): string => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const d = (raw as { descripcion?: unknown }).descripcion
    if (typeof d === 'string') return d
  }
  return ''
}

const sexoLabel = (sexo?: string): string => {
  const s = (sexo || '').trim().toLowerCase()
  if (s.startsWith('f')) return 'Femenino'
  if (s.startsWith('m')) return 'Masculino'
  return sexo || ''
}

export const CarteraTemporalView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [usuario, setUsuario] = useState<CurrentUser | null>(null)
  const [medicos, setMedicos] = useState<MedicoCartera[]>([])
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)

  const [editando, setEditando] = useState<MedicoCartera | null>(null)
  const [matriculaEdit, setMatriculaEdit] = useState('')
  const [ubicacionesEdit, setUbicacionesEdit] = useState<UbicacionMedico[]>([])
  const [duplicando, setDuplicando] = useState<MedicoCartera | null>(null)

  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  const showToast = (msg: string, type: 'success' | 'error' | 'info') => setToast({ msg, type })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      authService.getMe(),
      medicoService.list().catch(() => [] as MedicoBE[]),
      personaService.list().catch(() => [] as Persona[]),
      especialidadService.list().catch(() => []),
      ciudadService.list().catch(() => []),
    ])
      .then(([me, medicosRaw, personas, especialidades, ciudades]) => {
        if (cancelled) return
        setUsuario(me)
        const yo = me.persona_id
        const personaPorId = new Map<number, Persona>(personas.map((p) => [p.id, p]))
        const espPorId = new Map<number, string>(especialidades.map((e) => [e.id, e.nombre]))
        const ciudadPorId = new Map<number, string>(ciudades.map((c) => [c.id, c.nombre]))

        const filas: MedicoCartera[] = (Array.isArray(medicosRaw) ? medicosRaw : [])
          .filter((m) => m.visitador_id === yo && m.status !== false)
          .map((m) => {
            const p = personaPorId.get(m.persona_id)
            return {
              persona_id: m.persona_id,
              matricula: m.matricula || '',
              codigo: m.codigo || '',
              especialidad: espPorId.get(m.especialidad_id) ?? String(m.especialidad_id),
              clasificacion: Number(m.clasificacion ?? 0),
              frecuencia: m.frecuencia_visita || '',
              esParticular: !!m.es_particular,
              notas: descripcionDeNotas(m.notas),
              fechaCreacion: m.fecha_creacion || '',
              ultimaModificacion: m.ultima_modificacion || '',
              nombre: p?.nombre || `Médico ${m.matricula || m.persona_id}`,
              primerApellido: p?.primer_apellido || '',
              segundoApellido: p?.segundo_apellido || '',
              sexo: p?.sexo || '',
              telefono: p?.telefono || '',
              email: p?.correo || '',
              ci: p?.ci || '',
              ciudad: p?.ciudad_id ? ciudadPorId.get(p.ciudad_id) ?? '' : '',
              ubicaciones: normalizeUbicaciones(m.direccion),
            }
          })
        setMedicos(filas)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[CarteraTemporal] API no disponible', err)
        setMedicos([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const nombreCompleto = (m: MedicoCartera): string =>
    `${m.nombre} ${m.primerApellido}${m.segundoApellido ? ' ' + m.segundoApellido : ''}`.trim()

  const nombreVisible = (m: MedicoCartera): string => displayMedico(m.sexo, nombreCompleto(m)) || `Médico ${m.matricula}`

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return medicos
    return medicos.filter((m) =>
      nombreCompleto(m).toLowerCase().includes(q) ||
      m.matricula.toLowerCase().includes(q) ||
      m.especialidad.toLowerCase().includes(q) ||
      hospitalFromDireccion(m.ubicaciones).toLowerCase().includes(q) ||
      m.ubicaciones.some((u) => u.direccion.toLowerCase().includes(q)),
    )
  }, [search, medicos])

  const resumenNombre = usuario
    ? [usuario.nombre, usuario.primer_apellido].filter(Boolean).join(' ').trim()
    : '…'

  const showToastError = (err: unknown, prefijo: string) => {
    console.warn('[CarteraTemporal] error', err)
    const msg = err instanceof Error ? err.message : String(err)
    showToast(`${prefijo} ✗ ${msg}`, 'error')
  }

  // ---------- Editar matrícula y direcciones ----------

  const abrirEdicion = (m: MedicoCartera) => {
    setEditando(m)
    setMatriculaEdit(m.matricula)
    setUbicacionesEdit(m.ubicaciones.map((u) => ({ ...u })))
  }

  const cerrarEdicion = () => {
    if (savingRef.current) return
    setEditando(null)
  }

  const setUbicacionEn = (idx: number, cambios: Partial<UbicacionMedico>) => {
    setUbicacionesEdit((prev) => prev.map((u, i) => (i === idx ? { ...u, ...cambios } : u)))
  }

  const agregarUbicacion = () => {
    setUbicacionesEdit((prev) => [
      ...prev,
      { id: `u${Date.now()}`, direccion: '', detalle: '', coords: coordsCercaDeMi() },
    ])
  }

  const quitarUbicacion = (idx: number) => {
    setUbicacionesEdit((prev) => prev.filter((_, i) => i !== idx))
  }

  const guardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editando || savingRef.current) return
    const matricula = matriculaEdit.trim()
    if (!matricula) {
      showToast('La matrícula es obligatoria', 'error')
      return
    }
    const pid = editando.persona_id
    const ubicaciones = ubicacionesEdit.filter((u) => u.direccion.trim() || u.detalle.trim())
    savingRef.current = true
    setSaving(true)
    try {
      // direccion es JSONB: se manda el array ya parseado, nunca stringify.
      await medicoService.update(pid, { matricula, direccion: ubicaciones })
      setMedicos((prev) =>
        prev.map((m) =>
          m.persona_id === pid ? { ...m, matricula, ubicaciones } : m,
        ),
      )
      showToast(`Médico actualizado ✓ ${nombreVisible(editando)}`, 'success')
      setEditando(null)
    } catch (err) {
      showToastError(err, 'No se actualizó')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  // ---------- Marcar como duplicado ----------

  const marcarDuplicado = async () => {
    if (!duplicando || savingRef.current) return
    const pid = duplicando.persona_id
    savingRef.current = true
    setSaving(true)
    try {
      const actualizado = await medicoService.update(pid, { marcar_duplicado: true })
      setMedicos((prev) => prev.filter((m) => m.persona_id !== pid))
      showToast(
        `Marcado como duplicado ✓ · baja lógica · nueva matrícula ${actualizado.matricula}`,
        'success',
      )
      setDuplicando(null)
    } catch (err) {
      showToastError(err, 'No se marcó como duplicado')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  // ---------- Exportar a Excel ----------

  const direccionesTexto = (us: UbicacionMedico[]): string =>
    us.length === 0
      ? 'Sin dirección'
      : us
          .map((u) => {
            const partes = [
              u.direccion || u.hospital || '',
              u.detalle ? `(${u.detalle})` : '',
              u.coords ? `[${u.coords[0].toFixed(5)}, ${u.coords[1].toFixed(5)}]` : '',
            ]
            return partes.filter(Boolean).join(' ')
          })
          .join(' | ')

  const exportarExcel = async () => {
    if (medicos.length === 0) {
      showToast('No hay médicos en tu cartera para exportar', 'info')
      return
    }
    try {
      // Se carga xlsx bajo demanda: solo pesa en el bundle cuando alguien
      // toca "Exportar a Excel" (es una función temporal, no el flujo normal).
      const XLSX = await import('xlsx')
      const filas = medicos.map((m) => ({
        'Médico': nombreVisible(m),
        'Nombre': m.nombre,
        'Primer apellido': m.primerApellido,
        'Segundo apellido': m.segundoApellido,
        'Sexo': sexoLabel(m.sexo),
        'Matrícula': m.matricula,
        'Código': m.codigo,
        'Especialidad': m.especialidad,
        'Clasificación': m.clasificacion,
        'Frecuencia de visita': m.frecuencia,
        'Particular': m.esParticular ? 'Sí' : 'No',
        'Institución / Hospital': hospitalFromDireccion(m.ubicaciones) || 'Sin institución',
        'Direcciones': direccionesTexto(m.ubicaciones),
        'Teléfono': m.telefono,
        'Email': m.email,
        'CI': m.ci,
        'Ciudad': m.ciudad,
        'Notas': m.notas,
        'Visitador asignado': resumenNombre,
        'Estado': 'Activo',
        'Fecha de creación': m.fechaCreacion ? new Date(m.fechaCreacion).toLocaleString() : '',
        'Última modificación': m.ultimaModificacion ? new Date(m.ultimaModificacion).toLocaleString() : '',
      }))

      const ws = XLSX.utils.json_to_sheet(filas)
      const anchos = [26, 16, 16, 16, 10, 14, 12, 18, 8, 20, 10, 26, 52, 14, 26, 12, 16, 30, 22, 10, 20, 20]
      ws['!cols'] = anchos.map((wch) => ({ wch }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Cartera')
      const hoy = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `cartera_${hoy}.xlsx`)
      showToast(`Cartera exportada ✓ ${medicos.length} médicos`, 'success')
    } catch (err) {
      showToastError(err, 'No se pudo exportar')
    }
  }

  return (
    <div className="ct-page">
      <header className="ct-header">
        <button className="ct-icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="ct-title">Funciones Temporales</h1>
        <button className="ct-icon-btn" aria-label="Notificaciones" onClick={() => onNavigate('notificaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </button>
      </header>

      <SidebarMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={onNavigate}
        currentView={currentView}
        onLogout={onLogout}
      />

      <div className="ct-content">
        <div className="ct-intro">
          <div className="ct-intro-head">
            <div className="ct-intro-text">
              <h2>Mi cartera editable</h2>
              <p>
                {medicos.length} {medicos.length === 1 ? 'médico asignado' : 'médicos asignados'} · <strong>{resumenNombre}</strong>
              </p>
            </div>
            <button
              className="ct-btn ct-btn--excel"
              onClick={exportarExcel}
              disabled={loading || medicos.length === 0}
              title="Exportar toda tu cartera a Excel"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M7 10l5 5 5-5" />
                <path d="M12 15V3" />
              </svg>
              Exportar a Excel
            </button>
          </div>
          <span className="ct-temporal-badge">
            Función temporal · editá la matrícula y las direcciones solo de tus médicos
          </span>
          {loading && <p className="ct-loading">Cargando cartera...</p>}
        </div>

        <div className="ct-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a9ab5" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            className="ct-search-input"
            placeholder="Buscar por nombre, matrícula o dirección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <ul className="ct-list">
          {filtrados.map((m) => (
            <li key={m.persona_id} className="ct-card">
              <div className="ct-card-info">
                <div className="ct-card-top">
                  <span className="ct-card-nombre">{nombreVisible(m)}</span>
                  <span className="ct-card-matricula">{m.matricula || 'Sin matrícula'}</span>
                </div>
                <span className="ct-card-esp">{m.especialidad}</span>
                <span className="ct-card-dir">
                  <span className="ct-dot" />
                  {hospitalFromDireccion(m.ubicaciones) || m.ubicaciones[0]?.direccion || 'Sin dirección registrada'}
                </span>
                <span className="ct-card-flags">
                  {m.ubicaciones.length} {m.ubicaciones.length === 1 ? 'dirección' : 'direcciones'}
                  {m.esParticular ? ' · Particular' : ''}
                </span>
              </div>
              <div className="ct-card-actions">
                <button className="ct-btn ct-btn--editar" onClick={() => abrirEdicion(m)}>
                  Editar
                </button>
                <button className="ct-btn ct-btn--dup" onClick={() => setDuplicando(m)}>
                  Marcar duplicado
                </button>
              </div>
            </li>
          ))}
        </ul>

        {!loading && filtrados.length === 0 && (
          <p className="ct-empty">
            {medicos.length === 0
              ? 'No tienes médicos asignados en tu cartera.'
              : 'Sin resultados en tu cartera.'}
          </p>
        )}
      </div>

      {editando && (
        <div className="ct-overlay" onClick={cerrarEdicion}>
          <div className="ct-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ct-modal-head">
              <h3>Editar médico</h3>
              <button className="ct-modal-close" onClick={cerrarEdicion} aria-label="Cerrar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="ct-modal-sub">
              {nombreVisible(editando)} · {editando.especialidad}
            </p>

            <form onSubmit={guardarEdicion} className="ct-form">
              <label className="ct-field">
                Matrícula
                <input
                  value={matriculaEdit}
                  onChange={(e) => setMatriculaEdit(e.target.value)}
                  placeholder="Ej. MED-12345"
                  required
                />
              </label>

              <div className="ct-ubicaciones">
                <span className="ct-ubicaciones-title">
                  Direcciones ({ubicacionesEdit.length})
                </span>
                {ubicacionesEdit.length === 0 && (
                  <p className="ct-ubicaciones-empty">Sin direcciones. Agregá una nueva abajo.</p>
                )}
                {ubicacionesEdit.map((u, idx) => (
                  <div key={u.id} className="ct-ubicacion">
                    <div className="ct-ubicacion-head">
                      <span>Dirección {idx + 1}</span>
                      <button type="button" className="ct-btn-quitar" onClick={() => quitarUbicacion(idx)}>
                        Quitar
                      </button>
                    </div>
                    <label className="ct-field ct-field--mini">
                      Dirección
                      <input
                        value={u.direccion}
                        onChange={(e) => setUbicacionEn(idx, { direccion: e.target.value })}
                        placeholder={`Dirección ${idx + 1}`}
                      />
                    </label>
                    <label className="ct-field ct-field--mini">
                      Detalle
                      <input
                        value={u.detalle}
                        onChange={(e) => setUbicacionEn(idx, { detalle: e.target.value })}
                        placeholder="Ej. Consultorio 301"
                      />
                    </label>
                    <MapPicker
                      coords={u.coords}
                      onChange={(c) => setUbicacionEn(idx, { coords: c })}
                      height={130}
                    />
                  </div>
                ))}
                <button type="button" className="ct-btn ct-btn--add" onClick={agregarUbicacion}>
                  + Agregar dirección
                </button>
              </div>

              <div className="ct-modal-actions">
                <button type="button" className="ct-btn ct-btn--cancel" onClick={cerrarEdicion} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="ct-btn ct-btn--save" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {duplicando && (
        <div className="ct-overlay" onClick={() => { if (!savingRef.current) setDuplicando(null) }}>
          <div className="ct-modal ct-modal--sm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ct-modal-head">
              <h3>Marcar como duplicado</h3>
              <button
                className="ct-modal-close"
                onClick={() => { if (!savingRef.current) setDuplicando(null) }}
                aria-label="Cerrar"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="ct-modal-sub">
              ¿Marcar a <strong>{nombreVisible(duplicando)}</strong> como duplicado?
            </p>
            <ul className="ct-dup-list">
              <li>Pasa a estado <strong>eliminado lógico</strong> (deja de aparecer como activo en tu cartera).</li>
              <li>Se le asigna una <strong>matrícula nueva generada</strong> (formato <code>DUP-YYMMDD-xxxxxx</code>) que no existe en la base.</li>
              <li>Solo aplica a médicos de tu cartera.</li>
            </ul>
            <div className="ct-modal-actions">
              <button
                className="ct-btn ct-btn--cancel"
                onClick={() => setDuplicando(null)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button className="ct-btn ct-btn--danger" onClick={marcarDuplicado} disabled={saving}>
                {saving ? 'Marcando…' : 'Marcar como duplicado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {saving && (
        <div className="ct-busy" role="status" aria-live="polite">
          <span className="ct-busy-spinner" />
          <span>Guardando…</span>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
