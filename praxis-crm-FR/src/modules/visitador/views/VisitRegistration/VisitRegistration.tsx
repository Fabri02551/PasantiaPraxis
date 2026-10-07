import { useRef, useState, useEffect } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { authService } from '../../../auth/services/auth.service'
import { medicoService } from '../../../core/services/medico.service'
import { institucionService } from '../../../core/services/institucion.service'
import { personaService } from '../../../core/services/persona.service'
import { especialidadService } from '../../../core/services/especialidad.service'
import { visitaService } from '../../../core/services/visita.service'
import { laboratorioService, type LaboratorioPrecioBE } from '../../../core/services/laboratorio.service'
import { normalizeUbicaciones, firstDireccionTexto } from '../../../core/utils/medicoDireccion'
import { useGeolocation, distanciaMetros, formatearDistancia } from '../../../core/hooks/useGeolocation'
import { UbicacionMapa } from '../../../core/components/UbicacionMapa/UbicacionMapa'
import './VisitRegistration.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'instituciones' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

type UbicacionE = { id: string; direccion: string; detalle: string; coords: [number, number] | null }

type LabRow = {
  laboratorio_id: number
  nombre: string
  area: string
  costoUnit: number
  cantidad: number
}

const round2Cotiz = (n: number) => Math.round(n * 100) / 100

type DestinoExtra = {
  key: string
  tipo: 'medico' | 'institucion'
  id: number
  nombre: string
  especialidad: string
  hospital: string
  /** Nombre del visitador de la cartera, o null si es una visita fuera de cartera. */
  visitadorAsignado: string | null
  ubicaciones: UbicacionE[]
}

export const VisitRegistrationView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState('')
  const [selectedUbicacionId, setSelectedUbicacionId] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [exigencias, setExigencias] = useState('')
  const [destinos, setDestinos] = useState<DestinoExtra[]>([])
  const [miPersona, setMiPersona] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')
  const [rows, setRows] = useState<LabRow[]>([])
  const [disponibles, setDisponibles] = useState<LaboratorioPrecioBE[]>([])
  const [busqueda, setBusqueda] = useState('')

  const gps = useGeolocation()

  // Setup canvas for HiDPI
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = '#1B2A4E'
    ctx.lineWidth = 1.8
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const me = await authService.getMe().catch(() => null)
      const medicosRaw = await medicoService.list().catch(() => [])
      const instRaw = await institucionService.list().catch(() => [])
      const espesRaw = await especialidadService.list().catch(() => [])
      if (cancelled) return

      const yo = me?.persona_id ?? null
      setMiPersona(yo)
      const espDe = new Map<number, string>()
      if (Array.isArray(espesRaw)) espesRaw.forEach((es) => espDe.set(es.id, es.nombre))

      // Nombres de los visitadores de la cartera, solo los que aparecen. Son
      // pocos, así que traerlos de a uno es barato.
      const visitadores = new Map<number, string>()
      const tutorDeNombre = async (id: number): Promise<string> => {
        if (visitadores.has(id)) return visitadores.get(id)!
        const p = await personaService.getById(id).catch(() => null)
        const nombre = p ? [p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ').trim() : ''
        visitadores.set(id, nombre || 'Visitador sin nombre')
        return visitadores.get(id)!
      }

      const medicos: DestinoExtra[] = await Promise.all(
        (Array.isArray(medicosRaw) ? medicosRaw : []).map(async (b) => {
          const p = await personaService.getById(b.persona_id).catch(() => null)
          const nombre = p
            ? [p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ').trim()
            : `Médico ${b.matricula || b.persona_id}`
          const ubi = normalizeUbicaciones(b.direccion)
          const visitadorNombre = b.visitador_id ? await tutorDeNombre(b.visitador_id) : ''
          return {
            key: `medico-${b.persona_id}`,
            tipo: 'medico' as const,
            id: b.persona_id,
            nombre,
            especialidad: espDe.get(b.especialidad_id) ?? '',
            hospital: ubi[0]?.direccion || '',
            visitadorAsignado: visitadorNombre || null,
            ubicaciones: ubi.length > 0
              ? ubi.map((u) => ({ id: u.id, direccion: u.direccion, detalle: u.detalle, coords: u.coords }))
              : [{ id: 'u1', direccion: 'Sin dirección', detalle: '', coords: null }],
          }
        }),
      )

      const instituciones: DestinoExtra[] = await Promise.all(
        (Array.isArray(instRaw) ? instRaw : []).map(async (i) => {
          const ubi = normalizeUbicaciones(i.direccion)
          const visitadorNombre = i.visitador_id ? await tutorDeNombre(i.visitador_id) : ''
          return {
            key: `institucion-${i.id}`,
            tipo: 'institucion' as const,
            id: i.id,
            nombre: i.nombre || `Institución ${i.id}`,
            especialidad: i.tipo_contrato || 'Institución',
            hospital: firstDireccionTexto(i.direccion) || '',
            visitadorAsignado: visitadorNombre || null,
            ubicaciones: ubi.length > 0
              ? ubi.map((u) => ({ id: u.id, direccion: u.direccion, detalle: u.detalle, coords: u.coords }))
              : [{ id: 'u1', direccion: firstDireccionTexto(i.direccion) || 'Sin dirección', detalle: '', coords: null }],
          }
        }),
      )

      const todos = [...medicos, ...instituciones]
      if (!cancelled) setDestinos(todos)

      // Catálogo de estudios para la cotización (precio base).
      const precios = await laboratorioService.precios().catch(() => [])
      if (!cancelled) setDisponibles(Array.isArray(precios) ? precios : [])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    ctx?.closePath()
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    setHasSignature(false)
  }

  const filteredDestinos = (() => {
    const q = search.trim().toLowerCase()
    if (!q) return destinos
    return destinos.filter(
      (d) =>
        d.nombre.toLowerCase().includes(q) ||
        d.especialidad.toLowerCase().includes(q) ||
        d.hospital.toLowerCase().includes(q) ||
        (d.tipo === 'medico' ? 'médico' : 'institución').includes(q),
    )
  })()

  const selected = destinos.find((d) => d.key === selectedKey) || null
  const ubicaciones = selected?.ubicaciones || []
  const ubicElegida = ubicaciones.find((u) => u.id === selectedUbicacionId) || null

  const handleSelect = (key: string) => {
    setSelectedKey(key)
    const d = destinos.find((x) => x.key === key)
    if (d) setSelectedUbicacionId(d.ubicaciones[0]?.id || '')
  }

  const posicionGps = gps.resultado.estado === 'ok' ? gps.resultado.posicion : null
  const destinoCoords = ubicElegida?.coords ?? null
  const distanciaM =
    posicionGps && destinoCoords
      ? distanciaMetros(
          { latitud: posicionGps.latitud, longitud: posicionGps.longitud },
          { latitud: destinoCoords[0], longitud: destinoCoords[1] },
        )
      : null

  const filteredsCotiz = (() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return []
    const enRows = new Set(rows.map((r) => r.laboratorio_id))
    return disponibles.filter((p) => !enRows.has(p.id) && (p.nombre.toLowerCase().includes(q) || p.area.toLowerCase().includes(q)))
  })()

  const agregarEstudio = (p: LaboratorioPrecioBE) => {
    setRows((prev) => {
      const ya = prev.find((r) => r.laboratorio_id === p.id)
      if (ya) return prev.map((r) => (r.laboratorio_id === p.id ? { ...r, cantidad: r.cantidad + 1 } : r))
      return [
        ...prev,
        {
          laboratorio_id: p.id,
          nombre: p.nombre,
          area: p.area,
          costoUnit: round2Cotiz(p.costo),
          cantidad: 1,
        },
      ]
    })
    setBusqueda('')
  }

  const quitarEstudio = (id: number) => setRows((prev) => prev.filter((r) => r.laboratorio_id !== id))
  const setCant = (id: number, cant: number) =>
    setRows((prev) => prev.map((r) => (r.laboratorio_id === id ? { ...r, cantidad: Math.max(0, cant) } : r)))
  const totalCotiz = round2Cotiz(rows.reduce((acc, r) => acc + r.costoUnit * r.cantidad, 0))
  const totalItems = rows.reduce((acc, r) => acc + (r.cantidad > 0 ? 1 : 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!miPersona) {
      alert('No se pudo identificar al visitador - vuelve a iniciar sesión')
      return
    }
    if (!selected) {
      alert('Elegí un médico o institución para la visita extraordinaria')
      return
    }
    if (!hasSignature) {
      alert('Complete la firma digital antes de terminar la visita')
      return
    }
    const sinGps = gps.resultado.estado !== 'ok'
    if (sinGps) {
      const ok = window.confirm(
        'No se pudo capturar tu ubicación (GPS denegado o sin señal). ' +
          '¿Registramos igualmente la visita, marcada sin evidencia de ubicación?',
      )
      if (!ok) return
    }

    setGuardando(true)
    setMsg('')
    try {
      // La extraordinaria se crea y se registra en el mismo acto: sin fecha
      // tentativa (no está programada) y con extraordinaria=true. Si el
      // registro fallara después de crear, quedaría una visita "por visitar"
      // que nunca debió existir.
      const creada = await visitaService.crear({
        id_visitador: miPersona,
        id_medico: selected.tipo === 'medico' ? selected.id : null,
        institucion_id: selected.tipo === 'institucion' ? selected.id : null,
        extraordinaria: true,
        ubicacion_destino_id: ubicElegida?.id ?? null,
      })

      const firma = canvasRef.current?.toDataURL('image/png')
      const obs = observaciones.trim() || exigencias.trim() ? { observaciones: observaciones.trim(), exigencias: exigencias.trim() } : undefined
      await visitaService.registrar(creada.id, {
        fecha_visita: new Date().toISOString(),
        latitud: posicionGps?.latitud ?? null,
        longitud: posicionGps?.longitud ?? null,
        gps_precision_m: posicionGps?.precisionM ?? null,
        ubicacion_destino_id: ubicElegida?.id ?? null,
        destino_direccion: ubicElegida?.direccion || selected.hospital || null,
        destino_latitud: destinoCoords?.[0] ?? null,
        destino_longitud: destinoCoords?.[1] ?? null,
        firma,
        observacion: obs,
        satisfaccion: 0,
        duracion: 0,
      })

      // Cotización: una vez registrada la extraordinaria, se guardan los
      // estudios agregados del destino visitado.
      const estudios = rows.filter((r) => r.cantidad > 0).map((r) => ({ laboratorio_id: r.laboratorio_id, cantidad: r.cantidad }))
      if (estudios.length > 0) {
        const guardados = await visitaService.addLaboratorios(creada.id, estudios)
        if (!Array.isArray(guardados)) {
          throw new Error('no se pudo guardar la cotización')
        }
      }

      alert(`Visita extraordinaria registrada${selected ? ` para ${selected.nombre}` : ''}`)
      setObservaciones('')
      setExigencias('')
      setHasSignature(false)
      setSelectedKey('')
      setSelectedUbicacionId('')
      setRows([])
      setBusqueda('')
      gps.limpiar()
      onNavigate('home')
    } catch (err) {
      setMsg('Error al registrar la visita extraordinaria: ' + String(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="registro-page">
      <header className="registro-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Visita Extraordinaria</h1>
        <button className="icon-btn notification-btn" aria-label="Notificaciones" onClick={() => onNavigate('notificaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate} currentView={currentView} onLogout={onLogout} />

      <div className="registro-content">
        <form className="registro-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Buscar destino (médico o institución)</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg style={{ position: 'absolute', left: 12 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a9ab5" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Buscar por nombre, especialidad o institución..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, maxHeight: 180, overflowY: 'auto' }}>
              {filteredDestinos.map(d => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => handleSelect(d.key)}
                  className="form-input"
                  style={{
                    height: 'auto',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: selectedKey === d.key ? '#1B2A4E' : '#fff',
                    color: selectedKey === d.key ? '#fff' : '#1B2A4E',
                    borderColor: selectedKey === d.key ? '#1B2A4E' : '#e2e6ed',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{d.nombre}</span>
                  <span style={{ fontSize: 11, opacity: 0.8 }}>
                    {d.tipo === 'medico' ? d.especialidad || 'Médico' : 'Institución'} · {d.hospital || 'sin dirección'}
                  </span>
                </button>
              ))}
              {filteredDestinos.length === 0 && (
                <span style={{ fontSize: 12, color: '#8a9ab5', padding: 8 }}>
                  {destinos.length === 0 ? 'Sin destinos' : 'Sin resultados'}
                </span>
              )}
            </div>
          </div>

          {selected && (
            <>
              <div className="form-group">
                <label className="form-label">Ubicación</label>
                <select className="form-input" value={selectedUbicacionId} onChange={e => setSelectedUbicacionId(e.target.value)}>
                  {ubicaciones.map(u => (
                    <option key={u.id} value={u.id}>{u.direccion} {u.detalle ? `— ${u.detalle}` : ''}</option>
                  ))}
                </select>
              </div>
              <div style={{ background: '#f8f9fb', border: '1px solid #eef1f5', borderRadius: 10, padding: 10, fontSize: 12, color: '#1B2A4E' }}>
                <span style={{ fontWeight: 700 }}>Visitador de la cartera:</span>{' '}
                {selected.visitadorAsignado ? selected.visitadorAsignado : 'Sin asignar (visita fuera de cartera)'}
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Ubicación GPS</label>
                  <button
                    type="button"
                    className="btn-submit"
                    style={{ marginTop: 0, padding: '6px 12px', fontSize: 12 }}
                    onClick={() => {
                      gps.limpiar()
                      gps.pedir()
                    }}
                    disabled={gps.resultado.estado === 'pidiendo'}
                  >
                    {gps.resultado.estado === 'ok'
                      ? 'Actualizar GPS'
                      : gps.resultado.estado === 'pidiendo'
                        ? 'Buscando…'
                        : 'Tomar ubicación'}
                  </button>
                </div>
                <div style={{ marginTop: 8 }}>
                  <UbicacionMapa
                    destino={destinoCoords}
                    visitador={posicionGps ? [posicionGps.latitud, posicionGps.longitud] : null}
                    precisionM={posicionGps?.precisionM ?? null}
                    etiquetaDestino={selected.nombre}
                    distanciaM={distanciaM}
                    altura="200px"
                  />
                </div>
                {gps.resultado.estado === 'ok' && posicionGps && (
                  <div style={{ fontSize: 12, color: '#0e502e', marginTop: 8, fontWeight: 600 }}>
                    Ubicación tomada · precisión {posicionGps.precisionM != null ? `${Math.round(posicionGps.precisionM)} m` : 'no informada'}
                    {distanciaM != null && <span> · <strong>{formatearDistancia(distanciaM)}</strong> del destino</span>}
                  </div>
                )}
                {gps.resultado.estado === 'error' && (
                  <div style={{ fontSize: 12, color: '#92400e', marginTop: 8, background: '#fef6e7', borderRadius: 8, padding: '8px 10px' }}>
                    {'mensaje' in gps.resultado ? gps.resultado.mensaje : 'No se pudo obtener la ubicación.'}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Cotización de Laboratorios</label>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input
                className="form-input"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #dbe1ec', fontSize: 13 }}
                placeholder="Buscar estudio para agregar…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              {busqueda.trim() !== '' && filteredsCotiz.length === 0 && (
                <div
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
                    border: '1px solid #dbe1ec', borderRadius: 8, marginTop: 4, zIndex: 20,
                  }}
                >
                  <div style={{ padding: '12px 10px', color: '#7e8aa6', fontSize: 12 }}>
                    {disponibles.length === 0 ? 'Los estudios no cargaron (¿sesión vencida?)' : `Sin resultados para «${busqueda}»`}
                  </div>
                </div>
              )}
              {busqueda.trim() !== '' && filteredsCotiz.length > 0 && (
                <div
                  className="cotiz-combobox"
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
                    border: '1px solid #dbe1ec', borderRadius: 8, marginTop: 4,
                    boxShadow: '0 6px 18px rgba(15,23,42,0.10)', zIndex: 20, maxHeight: 260, overflowY: 'auto',
                  }}
                >
                  {filteredsCotiz.slice(0, 25).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="cotiz-option"
                      style={{
                        width: '100%', display: 'flex', justifyContent: 'space-between', gap: 10,
                        padding: '8px 10px', border: 'none', borderBottom: '1px solid #f1f5f9',
                        background: '#fff', textAlign: 'left', cursor: 'pointer', fontSize: 12.5,
                      }}
                      onClick={() => agregarEstudio(p)}
                    >
                      <span style={{ fontWeight: 600, color: '#1b2a4e' }}>{p.nombre}</span>
                      <span style={{ color: '#6b7a99', whiteSpace: 'nowrap' }}>{p.area} · ${p.costo.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: '#6b7a99', textAlign: 'left' }}>
                    <th style={{ padding: '6px 4px' }}>Estudio</th>
                    <th style={{ padding: '6px 4px' }}>Área</th>
                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>Costo unit.</th>
                    <th style={{ padding: '6px 4px', textAlign: 'center' }}>Cantidad</th>
                    <th style={{ padding: '6px 4px', textAlign: 'right' }}>Subtotal</th>
                    <th style={{ padding: '6px 4px' }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '14px 4px', color: '#7e8aa6', textAlign: 'center' }}>
                        Todavía no hay estudios agregados a la cotización.
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <tr key={r.laboratorio_id} style={{ borderTop: '1px solid #eef1f5' }}>
                      <td style={{ padding: '8px 4px', fontWeight: 600, color: '#1b2a4e' }}>{r.nombre}</td>
                      <td style={{ padding: '8px 4px', color: '#6b7a99' }}>{r.area}</td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>${r.costoUnit.toFixed(2)}</td>
                      <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button type="button" onClick={() => setCant(r.laboratorio_id, r.cantidad - 1)} disabled={r.cantidad === 0} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #dbe1ec', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>−</button>
                          <input
                            type="number"
                            min={0}
                            value={r.cantidad}
                            onChange={(e) => setCant(r.laboratorio_id, parseInt(e.target.value || '0', 10))}
                            style={{ width: 48, padding: '4px 2px', textAlign: 'center', borderRadius: 6, border: '1px solid #dbe1ec', fontSize: 12 }}
                          />
                          <button type="button" onClick={() => setCant(r.laboratorio_id, r.cantidad + 1)} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #dbe1ec', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>+</button>
                        </div>
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: '#1b2a4e' }}>${round2Cotiz(r.costoUnit * r.cantidad).toFixed(2)}</td>
                      <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                        <button type="button" onClick={() => quitarEstudio(r.laboratorio_id)} style={{ border: 'none', background: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ padding: '10px 4px' }} />
                    <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 700, color: '#1b2a4e' }}>{totalItems} estudios</td>
                    <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 700, color: '#0e502e', fontSize: 14 }}>${totalCotiz.toFixed(2)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea className="form-textarea" rows={3} placeholder="Detalle los puntos clave discutidos en la reunión..." value={observaciones} onChange={e => setObservaciones(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Exigencias / Acuerdos</label>
            <textarea className="form-textarea" rows={3} placeholder="Plazos de entrega, cotizaciones adicionales requeridas..." value={exigencias} onChange={e => setExigencias(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Firma Digital del Cliente</label>
            <div className="signature-wrapper">
              <canvas
                ref={canvasRef}
                className="signature-canvas"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {!hasSignature && <span className="signature-placeholder">Firmar aquí</span>}
              {hasSignature && (
                <button type="button" className="signature-clear" onClick={clearSignature}>
                  Limpiar
                </button>
              )}
              <div className="signature-line" />
            </div>
          </div>

          {msg && <p style={{ fontSize: 12, color: msg.startsWith('Error') ? '#b91c1c' : '#0e502e', fontWeight: 600 }}>{msg}</p>}

          <button type="submit" className="btn-submit" disabled={guardando}>
            {guardando ? 'Registrando…' : 'Registrar visita extraordinaria'}
          </button>
        </form>
      </div>
    </div>
  )
}

// Backward compat old name
export const VisitRegistration = VisitRegistrationView