import { useState, useMemo } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import './CalendarAdmin.css'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// fix leaflet icon
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow })

type AdminVisit = {
  id: string
  date: string // YYYY-MM-DD
  time: string
  company: string
  detail: string
  tecnico: string
  tecnicoId: number
  addr: string
  contact: string
  phone: string
  status: 'Confirmada' | 'Pendiente' | 'Programada'
  description: string
  coords: [number, number]
  hospital: string
  especialidad: string
}

const VISITADORES: { id: number; nombre: string }[] = []

const VISITAS: AdminVisit[] = []

function toKey(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export const CalendarAdminView: React.FC<{ currentView: AdminView; onNavigate: (v: AdminView) => void; onLogout: () => void }> = ({ currentView, onNavigate, onLogout }) => {
  const [cur, setCur] = useState(() => new Date(2026, 9, 1)) // Octubre 2026 como en imagen
  const [selectedDay, setSelectedDay] = useState<number>(12)
  const [selectedVisitador, setSelectedVisitador] = useState<string>('todos')
  const [activeVisit, setActiveVisit] = useState<AdminVisit | null>(null)

  const monthName = cur.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const y = cur.getFullYear()
  const m = cur.getMonth() + 1
  const days = new Date(y, cur.getMonth() + 1, 0).getDate()
  // Octubre 2026 empieza jueves -> offset 3 si lunes es 0? Pero simplificamos como lunes-start
  const firstDay = new Date(y, cur.getMonth(), 1).getDay() // 0 dom
  // Para imagen: 28,29,30 prev month muted. Calculamos igual pero simplificado: lun=0..dom=6
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)
  // Para mostrar leading muted como imagen (28,29,30) si offset>0, reemplaza nulls iniciales con prev month days
  // dejamos nulls como muted empty – suficiente

  const selectedKey = toKey(y, m, selectedDay)

  const visitasFiltradas = useMemo(() => {
    return VISITAS.filter(v => {
      if (selectedVisitador !== 'todos' && String(v.tecnicoId) !== selectedVisitador) return false
      return true
    })
  }, [selectedVisitador])

  const visitasDelDia = useMemo(() => {
    return visitasFiltradas.filter(v => v.date === selectedKey)
  }, [visitasFiltradas, selectedKey])

  // visitas por celda para pills
  const visitasPorDia = useMemo(() => {
    const map: Record<number, AdminVisit[]> = {}
    visitasFiltradas.forEach(v => {
      const d = Number(v.date.split('-')[2])
      const vd = new Date(v.date).getMonth() + 1
      const vy = Number(v.date.split('-')[0])
      if (vd === m && vy === y) {
        if (!map[d]) map[d] = []
        map[d].push(v)
      }
    })
    return map
  }, [visitasFiltradas, m, y])

  const fechaDetalle = new Date(y, m - 1, selectedDay).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Calendario de Visitas">
      <div className="cal-admin-layout">
        {/* Left: Calendario */}
        <div className="cal-admin-card">
          <div className="cal-admin-toolbar">
            <label className="cal-admin-select-label">
              Seleccionar Visitador:
              <select value={selectedVisitador} onChange={e => setSelectedVisitador(e.target.value)} className="cal-admin-select">
                <option value="todos">Todos los Visitadores</option>
                {VISITADORES.map(v => <option key={v.id} value={String(v.id)}>{v.nombre}</option>)}
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
                      <span key={p.id} className="cal-admin-pill" title={`${p.time} ${p.company}`} onClick={e => { e.stopPropagation(); setActiveVisit(p) }}>
                        {p.tecnico.split(' ')[0]} - {p.company.split(' ')[0]}
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
                    <span className="cal-detail-time">{v.time}</span>
                    <span className={`cal-detail-status cal-detail-status--${v.status.toLowerCase()}`}>{v.status}</span>
                  </div>
                  <div className="cal-detail-company">{v.company}</div>
                  <div className="cal-detail-desc">{v.detail}</div>
                  <div className="cal-detail-tecnico"><img src={`https://i.pravatar.cc/100?img=${10 + v.tecnicoId}`} alt={v.tecnico} className="cal-detail-avatar" /> Técnico: {v.tecnico}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Popup detalle visita – tipo móvil */}
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
              <span className={`cal-visit-badge status-${activeVisit.status.toLowerCase()}`}>{activeVisit.status}</span>
            </div>
            <div className="cal-visit-body">
              <span className="cal-visit-time">{activeVisit.time} · {activeVisit.date}</span>
              <h3 className="cal-visit-company">{activeVisit.company}</h3>
              <p className="cal-visit-detail">{activeVisit.detail}</p>
              <p className="cal-visit-addr">📍 {activeVisit.addr}</p>
              <div className="cal-visit-grid">
                <div><span className="cal-visit-label">CONTACTO</span><strong>{activeVisit.contact}</strong></div>
                <div><span className="cal-visit-label">TELÉFONO</span><strong>{activeVisit.phone}</strong></div>
              </div>
              <p className="cal-visit-desc">{activeVisit.description}</p>
              <div className="cal-visit-medico">
                <div className="cal-visit-medico-avatar">{activeVisit.tecnico.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
                <div>
                  <div className="cal-visit-medico-name">{activeVisit.tecnico}</div>
                  <div className="cal-visit-medico-spec">{activeVisit.especialidad}</div>
                  <div className="cal-visit-medico-hosp">{activeVisit.hospital}</div>
                </div>
              </div>
              <div className="cal-visit-map-wrap">
                <MapContainer center={activeVisit.coords} zoom={14} scrollWheelZoom={false} zoomControl={false} style={{ height: 160, width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
                  <Marker position={activeVisit.coords} />
                </MapContainer>
              </div>
              <a className="cal-visit-map-link" href={`https://www.openstreetmap.org/?mlat=${activeVisit.coords[0]}&mlon=${activeVisit.coords[1]}#map=14/${activeVisit.coords[0]}/${activeVisit.coords[1]}`} target="_blank" rel="noreferrer">Abrir en OpenStreetMap ↗</a>
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
