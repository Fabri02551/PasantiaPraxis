import { useState, useMemo, useEffect } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { authService, type CurrentUser } from '../../../auth/services/auth.service'
import { medicoService } from '../../../core/services/medico.service'
import { institucionService } from '../../../core/services/institucion.service'
import { personaService } from '../../../core/services/persona.service'
import { especialidadService } from '../../../core/services/especialidad.service'
import { visitaService } from '../../../core/services/visita.service'
import { normalizeUbicaciones, hospitalFromDireccion, firstDireccionTexto, type UbicacionMedico } from '../../../core/utils/medicoDireccion'
import { UbicacionMapa } from '../../../core/components/UbicacionMapa/UbicacionMapa'
import { InfoModal, type InfoVariant, type InfoDetail } from '../../components/InfoModal/InfoModal'
import './Planificador.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'instituciones' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

type Ubicacion = UbicacionMedico

// Destino = un médico o una institución de la cartera del visitador.
type DestinoPlan = {
  tipo: 'medico' | 'institucion'
  key: string // `${tipo}-${id}`
  id: number // persona_id (médico) | institucion.id
  nombre: string
  subtitulo: string // especialidad | tipo de contrato
  ubicaciones: Ubicacion[]
}

type VisitaTentativa = {
  id: string
  fecha: Date | null
  hora: string // e.g. "10:30"
  period: 'AM' | 'PM'
  showDate: boolean
  showTime: boolean
}

const NUEVA_VISITA = (): VisitaTentativa => ({
  id: `v${Date.now()}`,
  fecha: null,
  hora: '',
  period: 'AM',
  showDate: false,
  showTime: false,
})

export const PlanificadorView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [destinos, setDestinos] = useState<DestinoPlan[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [carteraConteo, setCarteraConteo] = useState('cargando…')
  const [busqueda, setBusqueda] = useState('')
  const [selectedDestino, setSelectedDestino] = useState('')
  const [selectedUbicacion, setSelectedUbicacion] = useState('')
  const [visitas, setVisitas] = useState<VisitaTentativa[]>([NUEVA_VISITA()])
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState<{
    variant: InfoVariant
    title: string
    message: string
    details?: InfoDetail[]
    redirectHome: boolean
  } | null>(null)

  // Calendar state for date picker – single month view per picker
  const [calMonth, setCalMonth] = useState(() => new Date())

  useEffect(() => {
    let cancelled = false
    Promise.all([
      authService.getMe(),
      medicoService.list().catch(() => []),
      institucionService.list().catch(() => []),
      especialidadService.list().catch(() => []),
    ])
      .then(async ([me, medicosRaw, institucionesRaw, especialidadesRaw]) => {
        if (cancelled) return
        const yo = me.persona_id
        const medicosMios = (Array.isArray(medicosRaw) ? medicosRaw : []).filter((m) => m.visitador_id === yo)
        const institucionesMias = (Array.isArray(institucionesRaw) ? institucionesRaw : []).filter((i) => i.visitador_id === yo)
        const especialidadDe = new Map<number, string>()
        if (Array.isArray(especialidadesRaw)) {
          especialidadesRaw.forEach((es) => especialidadDe.set(es.id, es.nombre))
        }

        const medicos: DestinoPlan[] = await Promise.all(medicosMios.map(async (b) => {
          let nombre = `Médico ${b.matricula || b.persona_id}`
          try {
            const p = await personaService.getById(b.persona_id)
            const apellidos = [p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ')
            if (p.nombre) nombre = `${p.nombre}${apellidos ? ` ${apellidos}` : ''}`
          } catch { /* sin persona, queda el fallback */ }
          const ubi = normalizeUbicaciones(b.direccion)
          const ubicaciones: Ubicacion[] = ubi.length > 0
            ? ubi
            // Sin coords de respaldo: un médico sin geocodificar no debería
            // "aparecer" sobre Quito. Se ofrece la dirección a texto plano.
            : [{ id: 'u1', direccion: hospitalFromDireccion(b.direccion) || 'Sin dirección', detalle: '', coords: null }]
          return {
            tipo: 'medico' as const,
            key: `medico-${b.persona_id}`,
            id: b.persona_id,
            nombre,
            subtitulo: especialidadDe.get(b.especialidad_id) ?? String(b.especialidad_id),
            ubicaciones,
          }
        }))

        const instituciones: DestinoPlan[] = institucionesMias.map((b) => ({
          tipo: 'institucion' as const,
          key: `institucion-${b.id}`,
          id: b.id,
          nombre: b.nombre || `Institución ${b.id}`,
          subtitulo: b.tipo_contrato || 'Institución',
          ubicaciones: [{ id: 'u1', direccion: firstDireccionTexto(b.direccion) || 'Sin dirección registrada', detalle: '', coords: null }],
        }))

        if (cancelled) return
        const todos = [...medicos, ...instituciones]
        setCurrentUser(me)
        setDestinos(todos)
        setSelectedDestino(todos[0]?.key ?? '')
        setSelectedUbicacion(todos[0]?.ubicaciones[0]?.id ?? '')
        setCarteraConteo(`${medicos.length} médicos · ${instituciones.length} instituciones`)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[Planificador] API no disponible', err)
        setDestinos([])
        setCarteraConteo('sin conexión a la API')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const destino = useMemo(() => destinos.find((d) => d.key === selectedDestino) || null, [destinos, selectedDestino])
  const ubicaciones = destino?.ubicaciones || []
  const ubicacionElegida = ubicaciones.find((u) => u.id === selectedUbicacion) || null

  // Buscador por nombre, especialidad/tipo o institución de la cartera.
  const destinosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return destinos
    return destinos.filter((d) =>
      d.nombre.toLowerCase().includes(q) ||
      d.subtitulo.toLowerCase().includes(q) ||
      (d.tipo === 'institucion' ? 'institución' : 'médico').includes(q),
    )
  }, [busqueda, destinos])

  const medicosFiltrados = destinosFiltrados.filter((d) => d.tipo === 'medico')
  const institucionesFiltradas = destinosFiltrados.filter((d) => d.tipo === 'institucion')

  // Si el destino seleccionado queda fuera del filtro, elegir el primero visible.
  useEffect(() => {
    if (destinosFiltrados.length === 0) return
    if (!destinosFiltrados.some((d) => d.key === selectedDestino)) {
      setSelectedDestino(destinosFiltrados[0].key)
      setSelectedUbicacion(destinosFiltrados[0].ubicaciones[0]?.id ?? '')
    }
  }, [busqueda, destinosFiltrados, selectedDestino])

  const handleDestinoChange = (key: string) => {
    setSelectedDestino(key)
    const d = destinos.find((x) => x.key === key)
    if (d) setSelectedUbicacion(d.ubicaciones[0]?.id || '')
  }

  const updateVisita = (id: string, patch: Partial<VisitaTentativa>) => {
    setVisitas(prev => prev.map(v => (v.id === id ? { ...v, ...patch } : v)))
  }

  const addVisita = () => {
    setVisitas(prev => [...prev, NUEVA_VISITA()])
  }

  const removeVisita = (id: string) => {
    setVisitas(prev => (prev.length <= 1 ? prev : prev.filter(v => v.id !== id)))
  }

  // Combina fecha + hora (AM/PM) en un Date local.
  const resuelveFecha = (v: VisitaTentativa): Date | null => {
    if (!v.fecha) return null
    const d = new Date(v.fecha)
    let hh = 0
    let mm = 0
    if (v.hora) {
      const [hs, ms] = v.hora.split(':')
      hh = parseInt(hs, 10) || 0
      mm = parseInt(ms, 10) || 0
      if (v.period === 'PM' && hh < 12) hh += 12
      if (v.period === 'AM' && hh === 12) hh = 0
    }
    d.setHours(hh, mm, 0, 0)
    return d
  }

  const handleRegistrar = async () => {
    if (!currentUser) {
      setModal({
        variant: 'error',
        title: 'Sesión requerida',
        message: 'No se pudo identificar al visitador. Vuelve a iniciar sesión.',
        redirectHome: false,
      })
      return
    }
    if (!destino) {
      setModal({
        variant: 'error',
        title: 'Sin destinos',
        message: 'No hay destinos en tu cartera para planificar (médicos o instituciones asignados a ti).',
        redirectHome: false,
      })
      return
    }
    const sinFecha = visitas.filter((v) => !v.fecha)
    if (sinFecha.length > 0) {
      setModal({
        variant: 'error',
        title: 'Falta la fecha',
        message: `Todas las visitas tentativas deben tener fecha seleccionada (falta la ${sinFecha[0].id === visitas[0].id ? 'primera' : 'alguna'}).`,
        redirectHome: false,
      })
      return
    }

    const miPersona = currentUser.persona_id
    if (!miPersona) {
      setModal({
        variant: 'error',
        title: 'Sesión requerida',
        message: 'No se pudo identificar al visitador. Vuelve a iniciar sesión.',
        redirectHome: false,
      })
      return
    }

    setSaving(true)
    const creadas: unknown[] = []
    const errores: string[] = []
    // La ubicación elegida identifica el consultorio/sede dentro del destino:
    // ese id es lo que después se confirma en CompletarVisita y lo que al
    // registrar la visita queda en visita.ubicacion_destino_id.
    const ubicacionDestino = selectedUbicacion || destino.ubicaciones[0]?.id || null
    for (const v of visitas) {
      const ft = resuelveFecha(v)
      if (!ft) continue
      try {
        const creada = await visitaService.crear({
          id_visitador: miPersona,
          id_medico: destino.tipo === 'medico' ? destino.id : null,
          institucion_id: destino.tipo === 'institucion' ? destino.id : null,
          fecha_visita_tentativa: ft.toISOString(),
          ubicacion_destino_id: ubicacionDestino,
        })
        creadas.push(creada)
      } catch (err) {
        errores.push(err instanceof Error ? err.message : String(err))
      }
    }
    setSaving(false)

    if (errores.length > 0) {
      setModal({
        variant: 'error',
        title: 'Planificación parcial',
        message: `Se crearon ${creadas.length} de ${visitas.length} visita(s). Revisa los errores e inténtalo de nuevo.`,
        details: errores.slice(0, 5).map((e, i) => ({ label: `Error ${i + 1}`, value: e })),
        redirectHome: false,
      })
      return
    }
    const nombreDestino = `${destino.nombre} (${destino.tipo === 'medico' ? 'médico' : 'institución'})`
    const direccionDestino = ubicaciones.find((u) => u.id === selectedUbicacion)?.direccion ?? '…'
    setModal({
      variant: 'success',
      title: 'Planificación registrada',
      message: `Planificación registrada para ${nombreDestino} en ${direccionDestino}.`,
      details: [
        { label: 'Destino', value: nombreDestino },
        { label: 'Ubicación', value: direccionDestino },
        { label: 'Visitas', value: `${visitas.length} visita(s) tentativa(s)` },
        { label: 'Estado', value: 'por visitar' },
      ],
      redirectHome: true,
    })
  }

  const handleModalAccept = () => {
    const goHome = modal?.redirectHome ?? false
    setModal(null)
    if (goHome) {
      setVisitas([NUEVA_VISITA()])
      onNavigate('home')
    }
  }

  // helpers for calendar rendering
  const renderCalendar = (visitaId: string) => {
    const y = calMonth.getFullYear()
    const m = calMonth.getMonth()
    const days = new Date(y, m + 1, 0).getDate()
    const firstDay = new Date(y, m, 1).getDay() // 0 dom
    const offset = firstDay === 0 ? 6 : firstDay - 1 // lun=0
    const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
    while (cells.length % 7 !== 0) cells.push(null)
    const monthLabel = calMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    return (
      <div className="plan-cal">
        <div className="plan-cal-head">
          <button type="button" className="plan-cal-nav" onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button>
          <span className="plan-cal-month">{monthLabel}</span>
          <button type="button" className="plan-cal-nav" onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button>
        </div>
        <div className="plan-cal-weekdays"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div>
        <div className="plan-cal-grid">
          {cells.map((d, i) =>
            d === null ? (
              <span key={i} className="plan-cal-cell muted" />
            ) : (
              <button
                key={i}
                type="button"
                className="plan-cal-cell"
                onClick={() => {
                  const nd = new Date(y, m, d)
                  updateVisita(visitaId, { fecha: nd, showDate: false })
                }}
              >
                {d}
              </button>
            ),
          )}
        </div>
      </div>
    )
  }

  const renderTimePicker = (visita: VisitaTentativa) => {
    const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
    const minutes = ['00', '15', '30', '45']
    const currentHour = visita.hora ? visita.hora.split(':')[0] : ''
    const currentMin = visita.hora ? visita.hora.split(':')[1] : ''
    return (
      <div className="plan-time">
        <div className="plan-time-row">
          <span className="plan-time-label">Hora</span>
          <div className="plan-time-grid">
            {hours.map(h => (
              <button
                key={h}
                type="button"
                className={`plan-time-btn ${currentHour === h ? 'active' : ''}`}
                onClick={() => {
                  const min = currentMin || '00'
                  updateVisita(visita.id, { hora: `${h}:${min}` })
                }}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
        <div className="plan-time-row">
          <span className="plan-time-label">Min</span>
          <div className="plan-time-grid">
            {minutes.map(m => (
              <button
                key={m}
                type="button"
                className={`plan-time-btn ${currentMin === m ? 'active' : ''}`}
                onClick={() => {
                  const h = currentHour || '09'
                  updateVisita(visita.id, { hora: `${h}:${m}` })
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="plan-time-row">
          <span className="plan-time-label">Periodo</span>
          <div className="plan-ampm">
            <button
              type="button"
              className={`plan-ampm-btn ${visita.period === 'AM' ? 'active' : ''}`}
              onClick={() => updateVisita(visita.id, { period: 'AM' })}
            >
              AM
            </button>
            <button
              type="button"
              className={`plan-ampm-btn ${visita.period === 'PM' ? 'active' : ''}`}
              onClick={() => updateVisita(visita.id, { period: 'PM' })}
            >
              PM
            </button>
          </div>
        </div>
        <div className="plan-time-actions">
          <button type="button" className="plan-time-ok" onClick={() => updateVisita(visita.id, { showTime: false })}>
            Aceptar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="plan-page">
      <header className="plan-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Planificador</h1>
        <button className="icon-btn notification-btn" aria-label="Notificaciones" onClick={() => onNavigate('notificaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <span className="notification-dot" />
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate} currentView={currentView} onLogout={onLogout} />

      <div className="plan-content">
        <div className="plan-card">
          <h2 className="plan-title">Planificar visita</h2>
          <p className="plan-sub">Selecciona un médico o institución de <strong>tu cartera</strong> y propone fechas tentativas.</p>
          <p className="plan-sub" style={{ marginTop: 2 }}>Tu cartera: {carteraConteo}</p>

          <div className="plan-field">
            <label className="plan-label">Buscar en tu cartera</label>
            <div className="plan-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a9ab5" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input className="plan-search-input" placeholder="Médico, institución, especialidad…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
          </div>

          <div className="plan-field">
            <label className="plan-label">Médico / Institución</label>
            {destinos.length === 0 ? (
              <p style={{ fontSize: 12, color: '#7e8aa6', padding: '8px 0' }}>No hay médicos ni instituciones en tu cartera - sin datos asignados</p>
            ) : destinosFiltrados.length === 0 ? (
              <p style={{ fontSize: 12, color: '#7e8aa6', padding: '8px 0' }}>Sin resultados para "{busqueda}".</p>
            ) : (
              <>
                <select className="plan-select" value={selectedDestino} onChange={(e) => handleDestinoChange(e.target.value)}>
                  {medicosFiltrados.length > 0 && (
                    <optgroup label={`Médicos de tu cartera (${medicosFiltrados.length})`}>
                      {medicosFiltrados.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.nombre} — {m.subtitulo}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {institucionesFiltradas.length > 0 && (
                    <optgroup label={`Instituciones de tu cartera (${institucionesFiltradas.length})`}>
                      {institucionesFiltradas.map((i) => (
                        <option key={i.key} value={i.key}>
                          {i.nombre} — {i.subtitulo}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {destino && (
                  <span className="plan-hint">{destino.tipo === 'medico' ? 'Médico' : 'Institución'} asignado a tu cartera</span>
                )}
              </>
            )}
          </div>

          <div className="plan-field">
            <label className="plan-label">Ubicación</label>
            {ubicaciones.length === 0 ? (
              <p style={{ fontSize: 12, color: '#7e8aa6', padding: '8px 0' }}>Sin ubicaciones registradas</p>
            ) : (
              <>
                <select className="plan-select" value={selectedUbicacion} onChange={(e) => setSelectedUbicacion(e.target.value)}>
                  {ubicaciones.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.direccion} {u.detalle ? `— ${u.detalle}` : ''}
                    </option>
                  ))}
                </select>
                <span className="plan-hint">{ubicacionElegida?.detalle}</span>
                {(ubicacionElegida?.coords ?? null) && (
                  <div style={{ marginTop: 10 }}>
                    <UbicacionMapa
                      destino={ubicacionElegida?.coords ?? null}
                      etiquetaDestino={destino?.nombre}
                      altura="160px"
                      distanciaM={null}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="plan-card">
          <div className="plan-visitas-head">
            <h3 className="plan-visitas-title">Visitas tentativas</h3>
            <span className="plan-visitas-count">{visitas.length} {visitas.length === 1 ? 'visita' : 'visitas'}</span>
          </div>
          <p className="plan-sub" style={{ marginTop: 0 }}>Agrega una o más visitas. Usa botones para elegir fecha y hora (AM/PM).</p>

          <div className="plan-visitas-list">
            {visitas.map((v, idx) => (
              <div key={v.id} className="plan-visita-item">
                <div className="plan-visita-header">
                  <span className="plan-visita-index">Visita {idx + 1}</span>
                  <button type="button" className="plan-visita-remove" onClick={() => removeVisita(v.id)} disabled={visitas.length <= 1}>
                    Quitar
                  </button>
                </div>

                <div className="plan-visita-grid">
                  <div className="plan-field" style={{ margin: 0 }}>
                    <label className="plan-label">Fecha tentativa *</label>
                    <button
                      type="button"
                      className={`plan-picker-btn ${v.fecha ? 'has-value' : ''}`}
                      onClick={() => updateVisita(v.id, { showDate: !v.showDate, showTime: false })}
                    >
                      {v.fecha ? v.fecha.toLocaleDateString('es-BO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : 'Seleccionar fecha tentativa'}
                    </button>
                    {v.showDate && renderCalendar(v.id)}
                  </div>

                  <div className="plan-field" style={{ margin: 0 }}>
                    <label className="plan-label">Hora tentativa</label>
                    <button
                      type="button"
                      className={`plan-picker-btn ${v.hora ? 'has-value' : ''}`}
                      onClick={() => updateVisita(v.id, { showTime: !v.showTime, showDate: false })}
                    >
                      {v.hora ? `${v.hora} ${v.period}` : 'Seleccionar hora'}
                    </button>
                    {v.showTime && renderTimePicker(v)}
                  </div>
                </div>

                {(v.fecha || v.hora) && (
                  <div className="plan-visita-preview">
                    Tentativa {(v.fecha ? `el ${v.fecha.toLocaleDateString('es-BO')}` : '')} {(v.hora ? `a las ${v.hora} ${v.period}` : '')}
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="plan-hint" style={{ marginTop: 6 }}>
            Cada visita se guarda con fecha <strong>tentativa</strong> y estado <strong>"por visitar"</strong>.
          </p>

          <button type="button" className="plan-add-btn" onClick={addVisita}>
            + Agregar visita
          </button>
        </div>

        <button type="button" className="plan-submit" onClick={handleRegistrar} disabled={saving || destinos.length === 0}>
          {saving ? 'Guardando…' : 'Registrar planificación'}
        </button>
      </div>

      {modal && (
        <InfoModal
          open
          variant={modal.variant}
          title={modal.title}
          message={modal.message}
          details={modal.details}
          acceptLabel="Aceptar"
          onAccept={handleModalAccept}
        />
      )}
    </div>
  )
}