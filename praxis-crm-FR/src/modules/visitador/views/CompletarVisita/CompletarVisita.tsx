import { useState, useRef, useEffect, useMemo } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { medicoService } from '../../../core/services/medico.service'
import { institucionService } from '../../../core/services/institucion.service'
import { personaService } from '../../../core/services/persona.service'
import { laboratorioService, type LaboratorioPrecioBE } from '../../../core/services/laboratorio.service'
import { visitaService, type VisitaBE } from '../../../core/services/visita.service'
import { useGeolocation, distanciaMetros, formatearDistancia } from '../../../core/hooks/useGeolocation'
import { UbicacionMapa } from '../../../core/components/UbicacionMapa/UbicacionMapa'
import { normalizeUbicaciones } from '../../../core/utils/medicoDireccion'
import './CompletarVisita.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

type MedicoInfo = { nombre: string; especialidad: string; hospital: string; phone: string }

export type VisitaACompletar = {
  visitaId?: number
  id: string
  company: string
  detail: string
  addr: string
  time: string
  dateLabel?: string
  medico: MedicoInfo
  contact?: string
  phone?: string
  status?: string
}

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
  visita: VisitaACompletar | null
}

type LabRow = {
  laboratorio_id: number
  nombre: string
  area: string
  costoUnit: number
  cantidad: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export const CompletarVisitaView: React.FC<Props> = ({ onNavigate, currentView, onLogout, visita }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [observaciones, setObservaciones] = useState('')
  const [exigencias, setExigencias] = useState('')
  const [papeleta, setPapeleta] = useState('')
  const [satisfaccion, setSatisfaccion] = useState('')
  const [hasSignature, setHasSignature] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [visitData, setVisitData] = useState<VisitaBE | null>(null)
  const [destino, setDestino] = useState({ nombre: visita?.company ?? '', tipo: 'Médico', esParticular: false, ciudadId: null as number | null, faltante: '' })
  const [destinoCoords, setDestinoCoords] = useState<[number, number] | null>(null)
  const [destinoUbicacionId, setDestinoUbicacionId] = useState<string | null>(null)
  const [destinoDireccion, setDestinoDireccion] = useState('')
  const [rows, setRows] = useState<LabRow[]>([])
  const [disponibles, setDisponibles] = useState<LaboratorioPrecioBE[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardandoCotiz, setGuardandoCotiz] = useState(false)
  const [guardandoVisita, setGuardandoVisita] = useState(false)
  const [msg, setMsg] = useState('')
  const [guardado, setGuardado] = useState(false)

  const gps = useGeolocation()

  const videoId = visita?.visitaId

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
    if (!videoId) {
      setCargando(false)
      return
    }
    let muerto = false
    setCargando(true)
    setGuardado(false)
    ;(async () => {
      try {
        const v = await visitaService.getById(videoId)
        if (muerto) return
        setVisitData(v)

        // La API devuelve [] desde el backend, pero un GET antiguo/otro orígen
        // podría responder null: sin estudios es [] y el catálogo sigue cargando.
        const existentes = (await visitaService.getLaboratorios(videoId).catch(() => [])) ?? []

        let esParticular = false
        let ciudadId: number | null = null
        let nombre = visita?.company ?? `Visita #${videoId}`
        let subtitulo = visita?.detail ?? ''

        if (v.id_medico) {
          try {
            const m = await medicoService.getById(v.id_medico)
            const p = await personaService.getById(v.id_medico)
            esParticular = !!m?.es_particular
            ciudadId = p?.ciudad_id ?? null
            const full = p ? [p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ').trim() : ''
            if (full) nombre = full
            subtitulo = `${m?.matricula ? `Mat. ${m.matricula}` : 'Médico'}${esParticular ? ' · Particular' : ''}`

            // El consultorio que se visita. Se intenta el que quedó guardado en
            // la planificación (v.ubicacion_destino_id); si no existe o no, el
            // primer pin que tenga la cartera del médico.
            const ubicaciones = normalizeUbicaciones(m?.direccion)
            const elegida =
              ubicaciones.find((u) => u.id === v.ubicacion_destino_id) ??
              ubicaciones.find((u) => u.coords) ??
              null
            if (elegida) {
              setDestinoUbicacionId(elegida.id)
              setDestinoDireccion(elegida.direccion || elegida.detalle || '')
              if (elegida.coords) setDestinoCoords(elegida.coords)
            }
          } catch {
            /* sin datos extra */
          }
          setDestino({ nombre, tipo: 'Médico', esParticular, ciudadId, faltante: subtitulo })
        } else if (v.institucion_id) {
          try {
            const i = await institucionService.getById(v.institucion_id)
            esParticular = !!i?.es_particular
            ciudadId = i?.ciudad_id ?? null
            nombre = i?.nombre || nombre
            subtitulo = i?.tipo_contrato || 'Institución'

            const ubicaciones = normalizeUbicaciones(i?.direccion)
            const elegida =
              ubicaciones.find((u) => u.id === v.ubicacion_destino_id) ??
              ubicaciones.find((u) => u.coords) ??
              null
            if (elegida) {
              setDestinoUbicacionId(elegida.id)
              setDestinoDireccion(elegida.direccion || elegida.detalle || '')
              if (elegida.coords) setDestinoCoords(elegida.coords)
            }
          } catch {
            /* sin datos extra */
          }
          setDestino({ nombre, tipo: 'Institución', esParticular, ciudadId, faltante: subtitulo })
        } else {
          setDestino({ nombre, tipo: '—', esParticular, ciudadId, faltante: subtitulo })
        }

        const precios = await laboratorioService.precios(ciudadId ?? undefined).catch(() => [])
        const porId = new Map(existentes.map((l) => [l.laboratorio_id, l.cantidad]))
        // El catálogo completo queda para el buscador; la tabla solo lista lo
        // que agregó el visitador, en vez de cien filas con cantidad 0.
        setDisponibles(Array.isArray(precios) ? precios : [])
        setRows(
          (Array.isArray(precios) ? precios : [])
            .filter((p) => porId.has(p.id))
            .map((p) => ({
              laboratorio_id: p.id,
              nombre: p.nombre,
              area: p.area,
              costoUnit: round2(esParticular ? p.costo * (1 + p.comision_extra) : p.costo),
              cantidad: porId.get(p.id) ?? 1,
            })),
        )
      } catch (err) {
        if (!muerto) setMsg('No se pudo cargar la visita: ' + String(err))
      } finally {
        if (!muerto) setCargando(false)
      }
    })()

    setObservaciones('')
    setExigencias('')
    setPapeleta('')
    setSatisfaccion('')
    setHasSignature(false)
    setDestinoCoords(null)
    setDestinoUbicacionId(null)
    setDestinoDireccion('')
    setRows([])
    setDisponibles([])
    setBusqueda('')
    gps.limpiar()
    return () => {
      muerto = true
    }
  }, [videoId])

  const filtereds = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return []
    // El catálogo filtrado descarta lo que ya está en la cotización: un
    // estudio agregado no debería poder agregarse dos veces.
    const enRows = new Set(rows.map((r) => r.laboratorio_id))
    return disponibles.filter((p) => !enRows.has(p.id) && (p.nombre.toLowerCase().includes(q) || p.area.toLowerCase().includes(q)))
  }, [disponibles, rows, busqueda])

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
          costoUnit: round2(destino.esParticular ? p.costo * (1 + p.comision_extra) : p.costo),
          cantidad: 1,
        },
      ]
    })
    setBusqueda('')
  }

  const quitarEstudio = (id: number) => setRows((prev) => prev.filter((r) => r.laboratorio_id !== id))

  const totalCotiz = useMemo(() => round2(rows.reduce((acc, r) => acc + r.costoUnit * r.cantidad, 0)), [rows])
  const totalItems = rows.reduce((acc, r) => acc + (r.cantidad > 0 ? 1 : 0), 0)

  const setCant = (id: number, cant: number) => {
    setRows((prev) => prev.map((r) => (r.laboratorio_id === id ? { ...r, cantidad: Math.max(0, cant) } : r)))
  }

  const guardarCotizacion = async () => {
    if (!videoId) return
    setGuardandoCotiz(true)
    setMsg('')
    try {
      await visitaService.addLaboratorios(
        videoId,
        rows.filter((r) => r.cantidad > 0).map((r) => ({ laboratorio_id: r.laboratorio_id, cantidad: r.cantidad })),
      )
      const prevIds = new Set((await visitaService.getLaboratorios(videoId).catch(() => [])).map((l) => l.laboratorio_id))
      for (const id of prevIds) {
        if (!rows.some((r) => r.laboratorio_id === id && r.cantidad > 0)) {
          await visitaService.removeLaboratorio(videoId, id)
        }
      }
      setMsg('Cotización guardada')
    } catch (err) {
      setMsg('Error guardando la cotización: ' + String(err))
    } finally {
      setGuardandoCotiz(false)
    }
  }

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
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
    canvasRef.current?.getContext('2d')?.closePath()
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

  const posicionGps = gps.resultado.estado === 'ok' ? gps.resultado.posicion : null

  // La distancia se calcula aquí solo para mostrar; el servidor la vuelve a
  // calcular con haversine y es esa la que queda guardada. Lo que se manda es
  // la posición y la precisión, no la distancia.
  const distanciaM =
    posicionGps && destinoCoords
      ? distanciaMetros(
          { latitud: posicionGps.latitud, longitud: posicionGps.longitud },
          { latitud: destinoCoords[0], longitud: destinoCoords[1] },
        )
      : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!videoId) {
      alert('No hay visita seleccionada')
      return
    }
    if (!hasSignature) {
      alert('Complete la firma digital antes de terminar la visita')
      return
    }
    const sinGps = gps.resultado.estado !== 'ok'
    if (sinGps) {
      // Se registra igual: GPS denegado o sin señal en terreno no debería
      // dejarlo colgado. El backend lo marca con sin_evidencia_ubicacion.
      const ok = window.confirm(
        'No se pudo capturar tu ubicación (GPS denegado o sin señal). ' +
          '¿Registramos igualmente la visita, marcada sin evidencia de ubicación?',
      )
      if (!ok) return
    }

    setGuardandoVisita(true)
    setMsg('')
    try {
      const firma = canvasRef.current?.toDataURL('image/png')
      const obs = observaciones.trim() || exigencias.trim() ? { observaciones: observaciones.trim(), exigencias: exigencias.trim() } : undefined
      await visitaService.registrar(videoId, {
        fecha_visita: new Date().toISOString(),
        latitud: posicionGps?.latitud ?? null,
        longitud: posicionGps?.longitud ?? null,
        gps_precision_m: posicionGps?.precisionM ?? null,
        ubicacion_destino_id: destinoUbicacionId ?? null,
        destino_direccion: destinoDireccion || visita.addr || null,
        destino_latitud: destinoCoords?.[0] ?? null,
        destino_longitud: destinoCoords?.[1] ?? null,
        firma,
        observacion: obs,
        papeleta: parseInt(papeleta || '0', 10) || 0,
        satisfaccion: parseInt(satisfaccion || '0', 10) || 0,
        duracion: 0,
      })
      alert(`Visita #${videoId} registrada correctamente`)
      setGuardado(true)
      onNavigate('home')
    } catch (err) {
      setMsg('Error al registrar la visita: ' + String(err))
    } finally {
      setGuardandoVisita(false)
    }
  }

  if (!visita) {
    return (
      <div className="completar-page">
        <header className="completar-header">
          <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          <h1 className="header-title">Completar Visita</h1>
          <span style={{ width: 36 }} />
        </header>
        <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate as any} currentView={currentView as any} onLogout={onLogout} />
        <div className="completar-content">
          <p style={{ textAlign: 'center', color: '#6b7a99', marginTop: 40 }}>No hay visita seleccionada. Vuelve a Visitas programadas o Calendario y pulsa Completar visita.</p>
          <button className="btn-submit" style={{ marginTop: 16 }} onClick={() => onNavigate('home')}>Volver</button>
        </div>
      </div>
    )
  }

  const yaRealizada = visitData?.registrada || visitData?.estado === 'realizada'

  return (
    <div className="completar-page">
      <header className="completar-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
        <h1 className="header-title">Completar Visita</h1>
        <button className="icon-btn" aria-label="Volver" onClick={() => onNavigate('home')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate as any} currentView={currentView as any} onLogout={onLogout} />

      <div className="completar-content">
        <form className="completar-form" onSubmit={handleSubmit}>
          <div className="completar-visita-info">
            <h2 className="completar-company">{destino.nombre}</h2>
            <p className="completar-detail">{destino.faltante}</p>
            <p className="completar-addr">{visita.addr} · {visita.time} {visita.dateLabel ? `· ${visita.dateLabel}` : ''}</p>
            <span className={`completar-status status-${(yaRealizada ? 'realizada' : 'por-visitar')}`}>
              {yaRealizada ? 'Realizada' : 'Por visitar'} · {destino.tipo}
            </span>{' '}
            <span className="completar-status" style={{ background: destino.esParticular ? '#fef6e7' : '#eef1f5', color: destino.esParticular ? '#92400e' : '#6b7a99' }}>
              {destino.esParticular ? 'Particular' : destino.ciudadId != null ? 'Programada' : '—'}
            </span>
            {cargando && <p style={{ fontSize: 12, color: '#7e8aa6', marginTop: 8 }}>Cargando datos de la visita…</p>}
          </div>

          {!cargando && !yaRealizada && (
            <div className="cotizacion-card" style={{ border: '1px solid #eef1f5', borderRadius: 12, padding: 14, background: '#fbfcfe', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <h3 className="completar-medico-title" style={{ margin: 0 }}>Ubicación de la visita</h3>
                {gps.resultado.estado === 'pidiendo' && <span style={{ fontSize: 12, color: '#7e8aa6' }}>Buscando señal GPS…</span>}
              </div>

              <UbicacionMapa
                destino={destinoCoords}
                visitador={posicionGps ? [posicionGps.latitud, posicionGps.longitud] : null}
                precisionM={posicionGps?.precisionM ?? null}
                etiquetaDestino={destino.nombre || 'Destino'}
                distanciaM={distanciaM}
                altura="220px"
              />

              {destinoCoords ? (
                <p style={{ fontSize: 12, color: '#7e8aa6', margin: '8px 0 0' }}>
                  Destino: <strong>{destinoDireccion || destino.nombre}</strong>
                  {destinoCoords && (
                    <span> · {destinoCoords[0].toFixed(4)}, {destinoCoords[1].toFixed(4)}</span>
                  )}
                  {distanciaM != null && <span> · <strong>{formatearDistancia(distanciaM)}</strong> del pin</span>}
                </p>
              ) : (
                <p style={{ fontSize: 12, color: '#b91c1c', margin: '8px 0 0' }}>
                  Este destino no tiene coordenadas geocodificadas. La visita se registra sin pin de comparación.
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-submit"
                  style={{ marginTop: 0, flex: 1 }}
                  onClick={() => {
                    gps.limpiar()
                    gps.pedir()
                  }}
                  disabled={gps.resultado.estado === 'pidiendo'}
                >
                  {gps.resultado.estado === 'ok'
                    ? 'Volver a tomar ubicación'
                    : gps.resultado.estado === 'pidiendo'
                      ? 'Buscando…'
                      : 'Tomar mi ubicación (GPS)'}
                </button>
              </div>

              {gps.resultado.estado === 'ok' && posicionGps && (
                <div style={{ fontSize: 12, color: '#0e502e', marginTop: 8, fontWeight: 600 }}>
                  Ubicación tomada · precisión {posicionGps.precisionM != null ? `${Math.round(posicionGps.precisionM)} m` : 'no informada'}
                </div>
              )}

              {gps.resultado.estado === 'error' && (
                <div style={{ fontSize: 12, color: '#92400e', marginTop: 8, background: '#fef6e7', borderRadius: 8, padding: '8px 10px' }}>
                  {'mensaje' in gps.resultado ? gps.resultado.mensaje : 'No se pudo obtener la ubicación.'}
                </div>
              )}
            </div>
          )}

          {!cargando && !yaRealizada && (
            <div className="cotizacion-card" style={{ border: '1px solid #eef1f5', borderRadius: 12, padding: 14, background: '#fbfcfe' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <h3 className="completar-medico-title" style={{ margin: 0 }}>Cotización de Laboratorios</h3>
                <span style={{ fontSize: 11, color: '#7e8aa6' }}>
                  Ciudad: {destino.ciudadId != null ? `#${destino.ciudadId}` : 'sin ciudad asignada'}{destino.esParticular ? ' · con comisión particular' : ''}
                </span>
              </div>
              <p style={{ fontSize: 11, color: '#7e8aa6', margin: '6px 0 10px' }}>
                Busque un estudio por nombre o área; la cantidad se ajusta en la tabla y el subtotal se aplica al ingreso de la visita.
              </p>

              <div style={{ position: 'relative', marginBottom: 10 }}>
                <input
                  className="form-input"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #dbe1ec', fontSize: 13 }}
                  placeholder="Buscar estudio para agregar…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                {busqueda.trim() !== '' && (
                  <div
                    className="cotiz-combobox"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#fff',
                      border: '1px solid #dbe1ec',
                      borderRadius: 8,
                      marginTop: 4,
                      boxShadow: '0 6px 18px rgba(15,23,42,0.10)',
                      zIndex: 20,
                      maxHeight: 260,
                      overflowY: 'auto',
                    }}
                  >
                    {filtereds.length === 0 ? (
                      <div style={{ padding: '12px 10px', color: '#7e8aa6', fontSize: 12 }}>Sin resultados para «{busqueda}»</div>
                    ) : (
                      filtereds.slice(0, 25).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="cotiz-option"
                          style={{
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 10,
                            padding: '8px 10px',
                            border: 'none',
                            borderBottom: '1px solid #f1f5f9',
                            background: '#fff',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: 12.5,
                          }}
                          onClick={() => agregarEstudio(p)}
                        >
                          <span style={{ fontWeight: 600, color: '#1b2a4e' }}>{p.nombre}</span>
                          <span style={{ color: '#6b7a99', whiteSpace: 'nowrap' }}>
                            {p.area} · ${(destino.esParticular ? p.costo * (1 + p.comision_extra) : p.costo).toFixed(2)}
                          </span>
                        </button>
                      ))
                    )}
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
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
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
                        <td style={{ padding: '8px 4px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: '#1b2a4e' }}>${round2(r.costoUnit * r.cantidad).toFixed(2)}</td>
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

              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="btn-submit" style={{ marginTop: 0, flex: 1 }} disabled={guardandoCotiz} onClick={guardarCotizacion}>
                  {guardandoCotiz ? 'Guardando…' : 'Guardar cotización'}
                </button>
                {msg && <span style={{ fontSize: 12, color: msg.startsWith('Error') ? '#b91c1c' : '#0e502e', fontWeight: 600 }}>{msg}</span>}
              </div>
            </div>
          )}

          <div className="completar-medico-text">
            <h3 className="completar-medico-title">Médico asignado</h3>
            <p className="completar-medico-line"><strong>Nombre:</strong> {destino.nombre}</p>
            <p className="completar-medico-line"><strong>Tipo:</strong> {destino.tipo}</p>
            <p className="completar-medico-line"><strong>Hospital:</strong> {visita.medico.hospital || visita.addr}</p>
            {visita.phone && <p className="completar-medico-line"><strong>Teléfono:</strong> {visita.phone}</p>}
            {visita.contact && <p className="completar-medico-line"><strong>Contacto:</strong> {visita.contact}</p>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Boletas (papeleta)</label>
              <input
                type="number"
                min={0}
                step={1}
                className="form-input"
                placeholder="0"
                value={papeleta}
                onChange={(e) => setPapeleta(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Satisfacción (0–5)</label>
              <input
                type="number"
                min={0}
                max={5}
                step={1}
                className="form-input"
                placeholder="0"
                value={satisfaccion}
                onChange={(e) => setSatisfaccion(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea className="form-textarea" rows={3} placeholder="Detalle los puntos clave observados..." value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Exigencias / Acuerdos</label>
            <textarea className="form-textarea" rows={3} placeholder="Plazos, acuerdos, exigencias del cliente..." value={exigencias} onChange={(e) => setExigencias(e.target.value)} />
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
              {hasSignature && <button type="button" className="signature-clear" onClick={clearSignature}>Limpiar</button>}
              <div className="signature-line" />
            </div>
          </div>

          {yaRealizada && <p style={{ fontSize: 13, color: '#0e502e', fontWeight: 600 }}>Esta visita ya fue registrada como realizada.</p>}
          {guardado && <p style={{ fontSize: 13, color: '#0e502e', fontWeight: 600 }}>Visita registrada correctamente.</p>}

          <button type="submit" className="btn-submit" disabled={cargando || yaRealizada || guardandoVisita}>
            {guardandoVisita ? 'Registrando…' : yaRealizada ? 'Ya completada' : 'Completar visita'}
          </button>
        </form>
      </div>
    </div>
  )
}