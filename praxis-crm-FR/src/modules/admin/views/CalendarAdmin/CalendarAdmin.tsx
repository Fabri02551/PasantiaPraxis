import { useState, useMemo, useEffect } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import './CalendarAdmin.css'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import { getInitials, avatarStyle } from '../../../core/utils/avatar'
import { COCHABAMBA_COORDS } from '../../../core/utils/mapDefaults'
import { normalizeUbicaciones } from '../../../core/utils/medicoDireccion'
import { displayMedico } from '../../../core/utils/medicoPrefix'
import { visitadorService, type VisitadorBE } from '../../../core/services/visitador.service'
import { visitaService, type VisitaBE } from '../../../core/services/visita.service'
import { personaService } from '../../../core/services/persona.service'
import { medicoService } from '../../../core/services/medico.service'
import { institucionService } from '../../../core/services/institucion.service'
import { ENV } from '../../../core/config/env'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// fix leaflet icon
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow })

type EnrichedVisit = VisitaBE & {
  visitadorNombre: string
  destinoNombre: string
  destinoDetalle: string
  medicoSexo: string
}

function toKey(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function dateKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return toKey(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
}

const nombreVisitador = (v: VisitadorBE) =>
  `${v.nombre} ${v.primer_apellido}${v.segundo_apellido ? ' ' + v.segundo_apellido : ''}`.trim()

export const CalendarAdminView: React.FC<{ currentView: AdminView; onNavigate: (v: AdminView) => void; onLogout: () => void }> = ({ currentView, onNavigate, onLogout }) => {
  const [cur, setCur] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<number>(() => new Date().getDate())
  const [selectedVisitador, setSelectedVisitador] = useState<string>('todos')
  const [activeVisit, setActiveVisit] = useState<EnrichedVisit | null>(null)

  const [visitadores, setVisitadores] = useState<VisitadorBE[]>([])
  const [visitas, setVisitas] = useState<EnrichedVisit[]>([])
  const [loading, setLoading] = useState(false)
  const [apiStatus, setApiStatus] = useState(`API: ${ENV.API_URL}`)

  // Última visita del visitador seleccionado (panel dedicado)
  const [lastVisit, setLastVisit] = useState<EnrichedVisit | null>(null)
  const [lastVisitLoading, setLastVisitLoading] = useState(false)
  const [medicoUbi, setMedicoUbi] = useState<{ texto: string; coords: [number, number] | null }>({ texto: '', coords: null })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.allSettled([visitadorService.list(), visitaService.list()])
      .then(async ([vr, vir]) => {
        if (cancelled) return
        const vds: VisitadorBE[] = vr.status === 'fulfilled' && Array.isArray(vr.value) ? vr.value : []
        const vis: VisitaBE[] = vir.status === 'fulfilled' && Array.isArray(vir.value) ? vir.value : []
        setVisitadores(vds)

        // Enriquecer destino (médico o institución) con caché para no saturar la API
        const personaCache = new Map<number, string>()
        const personaSexo = new Map<number, string>()
        const instCache = new Map<number, { nombre: string; detalle: string }>()
        const getPersonaName = async (pid: number): Promise<string> => {
          if (personaCache.has(pid)) return personaCache.get(pid)!
          try {
            const p = await personaService.getById(pid)
            const n = `${p.nombre} ${p.primer_apellido}${p.segundo_apellido ? ' ' + p.segundo_apellido : ''}`.trim()
            personaCache.set(pid, n)
            personaSexo.set(pid, p.sexo || '')
            return n
          } catch {
            personaCache.set(pid, `Médico ${pid}`)
            return `Médico ${pid}`
          }
        };
        const enriched: EnrichedVisit[] = await Promise.all(vis.map(async (v) => {
          const vd = vds.find(x => x.persona_id === v.id_visitador)
          let destino = 'Sin destino'
          let detalle = ''
          let sexo = ''
          if (v.id_medico) {
            const n = await getPersonaName(v.id_medico)
            sexo = personaSexo.get(v.id_medico) || ''
            destino = n
            detalle = 'Médico'
          } else if (v.institucion_id) {
            if (!instCache.has(v.institucion_id)) {
              try {
                const inst = await institucionService.getById(v.institucion_id)
                instCache.set(v.institucion_id, { nombre: inst.nombre, detalle: 'Institución' })
              } catch {
                instCache.set(v.institucion_id, { nombre: `Institución ${v.institucion_id}`, detalle: 'Institución' })
              }
            }
            const inst = instCache.get(v.institucion_id)!
            destino = inst.nombre
            detalle = inst.detalle
          }
          return {
            ...v,
            visitadorNombre: vd ? nombreVisitador(vd) : `Visitador ${v.id_visitador}`,
            destinoNombre: destino,
            destinoDetalle: detalle,
            medicoSexo: sexo,
          }
        }))
        if (cancelled) return
        setVisitas(enriched)
        setApiStatus(`Conectado a ${ENV.API_URL} — ${vds.length} visitadores, ${enriched.length} visitas`)
      })
      .catch((err) => {
        if (cancelled) return
        setApiStatus(`Error: sin conexión a ${ENV.API_URL} — ${err instanceof Error ? err.message : 'error'}`)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  const monthName = cur.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const y = cur.getFullYear()
  const m = cur.getMonth() + 1
  const days = new Date(y, cur.getMonth() + 1, 0).getDate()
  const firstDay = new Date(y, cur.getMonth(), 1).getDay() // 0 dom
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedKey = toKey(y, m, selectedDay)

  const visitasFiltradas = useMemo(() => {
    return visitas.filter(v => {
      if (selectedVisitador !== 'todos' && String(v.id_visitador) !== selectedVisitador) return false
      return true
    })
  }, [visitas, selectedVisitador])

  const visitasDelDia = useMemo(() => {
    return visitasFiltradas.filter(v => {
      const k = dateKey(v.fecha_visita_tentativa) ?? dateKey(v.fecha_visita)
      return k === selectedKey
    })
  }, [visitasFiltradas, selectedKey])

  const visitasPorDia = useMemo(() => {
    const map: Record<number, EnrichedVisit[]> = {}
    visitasFiltradas.forEach(v => {
      const k = dateKey(v.fecha_visita_tentativa) ?? dateKey(v.fecha_visita)
      if (!k) return
      const [vy, vm, vd] = k.split('-').map(Number)
      if (vm === m && vy === y) {
        if (!map[vd]) map[vd] = []
        map[vd].push(v)
      }
    })
    return map
  }, [visitasFiltradas, m, y])

  // Última visita del visitador seleccionado: la más reciente por fecha de
  // reporte (fecha_visita); si no hay reportadas, la última programada.
  useEffect(() => {
    let cancelled = false
    const loadLast = async () => {
      if (selectedVisitador === 'todos') {
        setLastVisit(null)
        setMedicoUbi({ texto: '', coords: null })
        return
      }
      const vid = Number(selectedVisitador)
      const mine = visitas.filter(v => v.id_visitador === vid)
      if (mine.length === 0) {
        setLastVisit(null)
        setMedicoUbi({ texto: '', coords: null })
        return
      }
      setLastVisitLoading(true)
      const byTime = (iso?: string | null) => {
        const t = iso ? new Date(iso).getTime() : NaN
        return Number.isNaN(t) ? -Infinity : t
      }
      const sorted = [...mine].sort((a, b) => {
        const ra = a.registrada ? byTime(a.fecha_visita) : -Infinity
        const rb = b.registrada ? byTime(b.fecha_visita) : -Infinity
        if (ra !== rb) return rb - ra
        return (b.id ?? 0) - (a.id ?? 0)
      })
      const last = sorted[0]
      if (cancelled) return
      setLastVisit(last)
      // Ubicación del médico (primera de medico.direccion JSONB)
      if (last.id_medico) {
        try {
          const med = await medicoService.getById(last.id_medico)
          if (cancelled) return
          const [ubi] = normalizeUbicaciones(med.direccion)
          setMedicoUbi(ubi
            ? { texto: ubi.direccion || ubi.hospital || 'Dirección registrada', coords: ubi.coords }
            : { texto: 'Sin ubicación registrada del médico', coords: null })
        } catch {
          if (!cancelled) setMedicoUbi({ texto: 'Sin ubicación registrada del médico', coords: null })
        }
      } else {
        setMedicoUbi({ texto: '', coords: null })
      }
      setLastVisitLoading(false)
    }
    loadLast()
    return () => { cancelled = true }
  }, [selectedVisitador, visitas])

  const fechaDetalle = new Date(y, m - 1, selectedDay).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const selectedVdName = selectedVisitador === 'todos'
    ? null
    : (visitadores.find(v => String(v.persona_id) === selectedVisitador)?.nombre
      ? nombreVisitador(visitadores.find(v => String(v.persona_id) === selectedVisitador)!)
      : `Visitador ${selectedVisitador}`)

  const reporteCoords: [number, number] | null =
    lastVisit && lastVisit.latitud != null && lastVisit.longitud != null
      ? [lastVisit.latitud, lastVisit.longitud]
      : null

  return (
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Calendario de Visitas">
      <div style={{ fontSize: 11, color: loading ? '#2d9c9c' : '#6b7a99', fontWeight: 500, marginBottom: 8 }}>
        {loading ? 'Cargando desde API...' : apiStatus}
      </div>

      {/* Panel: última visita del visitador seleccionado */}
      {selectedVdName && (
        <div className="cal-admin-card" style={{ marginBottom: 14 }}>
          <h3 className="cal-detail-title">Última visita de {selectedVdName}</h3>
          {lastVisitLoading ? (
            <p className="cal-detail-empty">Buscando última visita...</p>
          ) : !lastVisit ? (
            <p className="cal-detail-empty">Este visitador aún no tiene visitas registradas en la base de datos.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="cal-visit-medico-avatar" style={avatarStyle(lastVisit.destinoNombre)}>
                  {getInitials(lastVisit.destinoNombre)}
                </span>
                <div>
                  <div className="cal-visit-medico-name">
                    {lastVisit.destinoDetalle === 'Médico'
                      ? displayMedico(lastVisit.medicoSexo, lastVisit.destinoNombre)
                      : lastVisit.destinoNombre}
                  </div>
                  <div className="cal-visit-medico-spec">
                    {lastVisit.destinoDetalle || 'Destino'} · {lastVisit.registrada ? 'Reportada' : 'Programada (sin reporte)'}
                  </div>
                </div>
              </div>
              <div className="cal-visit-grid">
                <div><span className="cal-visit-label">MÉDICO VISITADO</span><strong>{lastVisit.destinoDetalle === 'Médico' ? displayMedico(lastVisit.medicoSexo, lastVisit.destinoNombre) : lastVisit.destinoNombre}</strong></div>
                <div><span className="cal-visit-label">VISITADOR</span><strong>{lastVisit.visitadorNombre}</strong></div>
                <div><span className="cal-visit-label">FECHA TENTATIVA (PROGRAMADA)</span><strong>{fmtFecha(lastVisit.fecha_visita_tentativa)}</strong></div>
                <div><span className="cal-visit-label">FECHA DE REPORTE (ENVIADO)</span><strong>{lastVisit.registrada ? fmtFecha(lastVisit.fecha_visita) : 'Aún no reportada'}</strong></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 10 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E', margin: '0 0 6px' }}>Ubicación del médico</p>
                  <p style={{ fontSize: 11.5, color: '#6b7a99', margin: '0 0 6px' }}>📍 {medicoUbi.texto || '—'}</p>
                  <div className="cal-visit-map-wrap">
                    <MapContainer center={medicoUbi.coords ?? COCHABAMBA_COORDS} zoom={13} scrollWheelZoom={false} style={{ height: 150, width: '100%' }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
                      <Marker position={medicoUbi.coords ?? COCHABAMBA_COORDS} />
                    </MapContainer>
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E', margin: '0 0 6px' }}>Ubicación del reporte (donde se envió)</p>
                  <p style={{ fontSize: 11.5, color: '#6b7a99', margin: '0 0 6px' }}>
                    {reporteCoords ? `📍 ${reporteCoords[0].toFixed(5)}, ${reporteCoords[1].toFixed(5)}` : 'Sin coordenadas de reporte'}
                  </p>
                  <div className="cal-visit-map-wrap">
                    <MapContainer center={reporteCoords ?? COCHABAMBA_COORDS} zoom={13} scrollWheelZoom={false} style={{ height: 150, width: '100%' }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
                      <Marker position={reporteCoords ?? COCHABAMBA_COORDS} />
                    </MapContainer>
                  </div>
                  {reporteCoords && (
                    <a className="cal-visit-map-link" href={`https://www.openstreetmap.org/?mlat=${reporteCoords[0]}&mlon=${reporteCoords[1]}#map=14/${reporteCoords[0]}/${reporteCoords[1]}`} target="_blank" rel="noreferrer">Abrir reporte en OpenStreetMap ↗</a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="cal-admin-layout">
        {/* Left: Calendario */}
        <div className="cal-admin-card">
          <div className="cal-admin-toolbar">
            <label className="cal-admin-select-label">
              Seleccionar Visitador:
              <select value={selectedVisitador} onChange={e => setSelectedVisitador(e.target.value)} className="cal-admin-select">
                <option value="todos">Todos los Visitadores</option>
                {visitadores.map(v => <option key={v.persona_id} value={String(v.persona_id)}>{nombreVisitador(v)}</option>)}
              </select>
            </label>
            <div className="cal-admin-month-nav">
              <button className="cal-admin-nav-btn" onClick={() => setCur(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button>
              <span className="cal-admin-month">{monthName}</span>
              <button className="cal-admin-nav-btn" onClick={() => setCur(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button>
            </div>
          </div>

          <div className="cal-admin-weekdays"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span></div>

          <div className="cal-admin-grid">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} className="cal-admin-cell cal-admin-cell--muted" />
              const isSelected = d === selectedDay
              const pills = visitasPorDia[d] || []
              return (
                <button key={i} className={`cal-admin-cell ${isSelected ? 'cal-admin-cell--selected' : ''}`} onClick={() => setSelectedDay(d)}>
                  <span className="cal-admin-daynum">{d}</span>
                  <div className="cal-admin-pills">
                    {pills.slice(0, 2).map(p => (
                      <span key={p.id} className="cal-admin-pill" title={`${p.visitadorNombre} → ${p.destinoNombre}`} onClick={e => { e.stopPropagation(); setActiveVisit(p) }}>
                        {p.visitadorNombre.split(' ')[0]} - {p.destinoNombre.split(' ')[0]}
                      </span>
                    ))}
                    {pills.length > 2 && <span className="cal-admin-more">+{pills.length - 2}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: Detalle del día */}
        <div className="cal-detail-card">
          <h3 className="cal-detail-title">Detalle del Día Seleccionado</h3>
          <p className="cal-detail-date">{fechaDetalle}</p>

          {visitasDelDia.length === 0 ? (
            <p className="cal-detail-empty">No hay visitas planificadas para este día.</p>
          ) : (
            <div className="cal-detail-list">
              {visitasDelDia.map(v => (
                <button key={v.id} className="cal-detail-item" onClick={() => setActiveVisit(v)}>
                  <div className="cal-detail-item-head">
                    <span className="cal-detail-time">{fmtFecha(v.fecha_visita_tentativa)}</span>
                    <span className={`cal-detail-status ${v.registrada ? 'cal-detail-status--confirmada' : 'cal-detail-status--pendiente'}`}>{v.registrada ? 'Reportada' : 'Programada'}</span>
                  </div>
                  <div className="cal-detail-company">{v.destinoNombre}</div>
                  <div className="cal-detail-desc">{v.destinoDetalle}</div>
                  <div className="cal-detail-tecnico"><span className="cal-detail-avatar cal-detail-avatar--initials" style={avatarStyle(v.visitadorNombre)} aria-hidden>{getInitials(v.visitadorNombre)}</span> Técnico: {v.visitadorNombre}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Popup detalle visita */}
      {activeVisit && (
        <div className="cal-visit-overlay" onClick={() => setActiveVisit(null)} role="dialog" aria-modal>
          <div className="cal-visit-modal" onClick={e => e.stopPropagation()}>
            <div className="cal-visit-header">
              <button className="cal-visit-close" onClick={() => setActiveVisit(null)} aria-label="Cerrar detalle de visita">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
              <span className={`cal-visit-badge ${activeVisit.registrada ? 'status-confirmada' : 'status-pendiente'}`}>{activeVisit.registrada ? 'Reportada' : 'Programada'}</span>
            </div>
            <div className="cal-visit-body">
              <span className="cal-visit-time">Tentativa: {fmtFecha(activeVisit.fecha_visita_tentativa)}</span>
              <h3 className="cal-visit-company">{activeVisit.destinoNombre}</h3>
              <p className="cal-visit-detail">{activeVisit.destinoDetalle} · Visitador: {activeVisit.visitadorNombre}</p>
              <div className="cal-visit-grid">
                <div><span className="cal-visit-label">FECHA TENTATIVA</span><strong>{fmtFecha(activeVisit.fecha_visita_tentativa)}</strong></div>
                <div><span className="cal-visit-label">FECHA DE REPORTE</span><strong>{activeVisit.registrada ? fmtFecha(activeVisit.fecha_visita) : 'Aún no reportada'}</strong></div>
                <div><span className="cal-visit-label">SATISFACCIÓN</span><strong>{activeVisit.satisfaccion}/5</strong></div>
                <div><span className="cal-visit-label">DURACIÓN</span><strong>{activeVisit.duracion} min</strong></div>
              </div>
              <div className="cal-visit-medico">
                <div className="cal-visit-medico-avatar" style={avatarStyle(activeVisit.visitadorNombre)}>{getInitials(activeVisit.visitadorNombre)}</div>
                <div>
                  <div className="cal-visit-medico-name">{activeVisit.visitadorNombre}</div>
                  <div className="cal-visit-medico-spec">ID visitador: {activeVisit.id_visitador}</div>
                </div>
              </div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#1B2A4E', margin: '4px 0 0' }}>Ubicación del reporte</p>
              <div className="cal-visit-map-wrap">
                <MapContainer
                  center={activeVisit.latitud != null && activeVisit.longitud != null ? [activeVisit.latitud, activeVisit.longitud] : COCHABAMBA_COORDS}
                  zoom={13}
                  scrollWheelZoom={false}
                  style={{ height: 160, width: '100%' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
                  <Marker position={activeVisit.latitud != null && activeVisit.longitud != null ? [activeVisit.latitud, activeVisit.longitud] : COCHABAMBA_COORDS} />
                </MapContainer>
              </div>
              {activeVisit.latitud != null && activeVisit.longitud != null && (
                <a className="cal-visit-map-link" href={`https://www.openstreetmap.org/?mlat=${activeVisit.latitud}&mlon=${activeVisit.longitud}#map=14/${activeVisit.latitud}/${activeVisit.longitud}`} target="_blank" rel="noreferrer">Abrir en OpenStreetMap ↗</a>
              )}
            </div>
            <div className="cal-visit-footer">
              <button className="cal-visit-btn-close" onClick={() => setActiveVisit(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
