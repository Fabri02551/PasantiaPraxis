import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { storage } from '../../../core/lib/storage'
import { centroCiudad, centroide } from '../../../core/utils/ciudadCentro'
import { useMisVisitas, visitaToACompletar, type VisitaResuelta, type DestinoInfo } from '../../hooks/useMisVisitas'
import { cuentaVencidas } from '../../hooks/useNotificaciones'
import type { VisitaACompletar } from '../CompletarVisita/CompletarVisita'
import './Home.css'

// Fix default icon issue in Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const pad = (n: number) => String(n).padStart(2, '0')
const hoyKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function createColorIcon(color: string) {
  return L.divIcon({
    html: `<div style="background:${color}; width:22px; height:22px; border-radius:50% 50% 50% 0; transform:rotate(-45deg); border:2px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3); display:grid; place-items:center;"><span style="transform:rotate(45deg); color:white; font-size:11px; font-weight:700;">•</span></div>`,
    className: 'custom-marker',
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  })
}

const markerColors = ['#F9B233', '#2D9C9C', '#E94E6B', '#4A7CF7', '#7B5CFF']

// Zoom mínimo del mapa de la ruta. Más abajo se ve el país entero, que no
// sirve de nada para una visita dentro de la ciudad.
const ZOOM_MIN_RUTA = 12

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'instituciones' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface HomeProps {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
  onCompletar?: (visita: VisitaACompletar) => void
}

export const VisitadorHome: React.FC<HomeProps> = ({ onNavigate, currentView, onLogout, onCompletar }) => {
  const { porVisitar, loading, miCiudad } = useMisVisitas()
  // El punto rojo del encabezado solo se enciende si hay algo vencido de
  // verdad: antes estaba siempre encendido, incluso con la ruta al día.
  const vencidas = useMemo(() => cuentaVencidas(porVisitar), [porVisitar])
  const [menuOpen, setMenuOpen] = useState(false)
  const [detail, setDetail] = useState<VisitaResuelta | null>(null)
  // Índice de la visita enfocada al recorrer la ruta con el control del mapa.
  // -1 = ninguna enfocada; cada clic en "siguiente" avanza y envuelve.
  const [foco, setFoco] = useState(-1)
  const mapRef = useRef<L.Map | null>(null)

  const hoy = hoyKey()
  const pendientesHoy = useMemo(() => porVisitar.filter((v) => v.fecha === hoy), [porVisitar, hoy])
  const pendientesHoySur = useMemo(
    () => (pendientesHoy.length > 0 ? pendientesHoy : porVisitar.slice(0, 4)),
    [pendientesHoy, porVisitar],
  )

  // Solo las visitas con pin se pueden dibujar. Una sin coordenadas no debería
  // "aparecer" sobre Quito ni deformar la polyline de la ruta.
  const conPin = useMemo(
    () =>
      pendientesHoySur.filter(
        (v): v is VisitaResuelta & { destino: DestinoInfo & { coords: [number, number] } } =>
          Array.isArray(v.destino.coords) && v.destino.coords.length === 2,
      ),
    [pendientesHoySur],
  )
  // Posición propia guardada al iniciar sesión (pin azul "usted está aquí").
  // Va en useMemo para que el array no cambie de referencia en cada render:
  // el efecto que centra el mapa depende de él.
  const miPos = useMemo<[number, number] | null>(() => {
    const u = storage.getUbicacion()
    return u && Number.isFinite(u.latitud) && Number.isFinite(u.longitud) ? [u.latitud, u.longitud] : null
  }, [])
  // El mapa arranca en el centro de la ciudad del visitador, no en un pin
  // suelto. Es lo único estable: el primer destino cambia según las visitas
  // del día, y encuadrar la ruta entera aleja el mapa hasta mostrar el país.
  const ciudadCentro = useMemo(
    () => centroCiudad(miCiudad?.nombre) ?? centroide(conPin.map((v) => v.destino.coords)) ?? miPos,
    [miCiudad?.nombre, conPin, miPos],
  )
  const center = ciudadCentro ?? conPin[0]?.destino.coords ?? miPos
  // Zoom de ciudad: 13 entra el área urbana, 14 solo se usa si no se conoce la
  // ciudad y hay que acercarse al menos a los destinos.
  const ZOOM_CIUDAD = 13

  // Visitas con pin ordenadas de la más próxima a la más lejana en el tiempo:
  // es el orden que recorre el botón "siguiente visita".
  const conPinOrdenado = useMemo(
    () => [...conPin].sort((a, b) => a.hora.localeCompare(b.hora)),
    [conPin],
  )

  const centrarEnMiUbicacion = () => {
    if (!miPos) return
    mapRef.current?.setView(miPos, 16)
  }

  // El mapa se centra en el centro de la ciudad cuando la carga termina.
  // MapContainer solo lee `center` en el primer render, así que sin esto el
  // mapa queda donde se montó (con los datos todavía vacíos) y nunca se
  // corrige aunque después lleguen la ciudad y los destinos.
  const centerKey = center ? center.join(',') : ''
  useEffect(() => {
    const mapa = mapRef.current
    if (!mapa || !centerKey) return
    mapa.setView(centerKey.split(',').map(Number) as [number, number], ZOOM_CIUDAD, { animate: false })
  }, [centerKey])

  // Al abrir el detalle de una visita el mapa va a ese destino.
  const abrirDetalle = (v: VisitaResuelta) => {
    setDetail(v)
    const coords = v.destino.coords
    if (Array.isArray(coords) && coords.length === 2) {
      mapRef.current?.setView(coords, 16)
    }
  }

  const siguienteVisita = () => {
    if (conPinOrdenado.length === 0) return
    const n = foco >= conPinOrdenado.length - 1 ? 0 : foco + 1
    setFoco(n)
    mapRef.current?.setView(conPinOrdenado[n].destino.coords, 15)
  }

  return (
    <div className="visitador-page">
      <header className="visitador-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Ruta del Día</h1>
        <button className="icon-btn notification-btn" aria-label="Notificaciones" onClick={() => onNavigate('notificaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {vencidas > 0 && <span className="notification-dot" />}
        </button>
      </header>
      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate} currentView={currentView} onLogout={onLogout} />

      <div className="visitador-content">
        <section className="map-card">
          <div className="map-badge">
            <span className="badge-dot" />
            {loading ? 'Cargando…' : `${porVisitar.length} Visitas Pendientes`}
          </div>
          <div className="map-wrapper">
            {!center ? (
              <div className="home-mapa-vacio">
                <span>Sin coordenadas en la ruta</span>
                <small>Ninguna visita pendiente tiene ubicación geocodificada. Se muestran igual en la lista.</small>
              </div>
            ) : (
              <>
              <MapContainer
              ref={mapRef}
              center={center}
              zoom={ZOOM_CIUDAD}
              minZoom={ZOOM_MIN_RUTA}
              scrollWheelZoom={false}
              className="osm-map"
              zoomControl={false}
            >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {conPin.length > 1 && (
                  <Polyline
                    positions={conPin.map((v) => v.destino.coords)}
                    pathOptions={{ color: '#F9B233', weight: 4, opacity: 0.9 }}
                  />
                )}
                {conPin.slice(0, 4).map((v, idx) => (
                  <Marker key={v.id} position={v.destino.coords} icon={createColorIcon(markerColors[idx % markerColors.length])}>
                    <Popup>
                      <strong>{v.destino.nombre}</strong>
                      <br />
                      {v.destino.subtitulo || 'Médico/Institución'}
                    </Popup>
                  </Marker>
                ))}
                {miPos && (
                  <CircleMarker
                    center={miPos}
                    radius={9}
                    pathOptions={{ color: '#2563EB', weight: 2, fillColor: '#2563EB', fillOpacity: 0.55 }}
                  >
                    <Popup>Tu ubicación actual</Popup>
                  </CircleMarker>
                )}
                {foco >= 0 && conPinOrdenado[foco] && (
                  <CircleMarker
                    center={conPinOrdenado[foco].destino.coords}
                    radius={17}
                    pathOptions={{ color: '#1B2A4E', weight: 2, fillColor: '#F9B233', fillOpacity: 0.25 }}
                  >
                    <Popup>
                      <strong>{conPinOrdenado[foco].destino.nombre}</strong>
                      <br />
                      {conPinOrdenado[foco].destino.subtitulo || 'Médico/Institución'}
                    </Popup>
                  </CircleMarker>
                )}
              </MapContainer>
              <div className="map-controls">
                <button
                  type="button"
                  className="map-control-btn"
                  onClick={centrarEnMiUbicacion}
                  aria-label="Centrar en tu ubicación"
                  title="Centrar en tu ubicación"
                  disabled={!miPos}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <circle cx="12" cy="12" r="7" />
                    <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
                    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="map-control-btn"
                  onClick={siguienteVisita}
                  aria-label="Siguiente visita de la ruta"
                  title="Siguiente visita de la ruta"
                  disabled={conPinOrdenado.length === 0}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                  {conPinOrdenado.length > 0 && (
                    <span className="map-control-count">
                      {foco < 0 ? 1 : foco + 1}/{conPinOrdenado.length}
                    </span>
                  )}
                </button>
              </div>
              </>
            )}
          </div>
        </section>

        <div className="action-row">
          <button className="btn-visit" onClick={() => onNavigate('registro')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Visita Extraordinaria
          </button>
          <button className="btn-calendar" onClick={() => onNavigate('calendario')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Calendario
          </button>
        </div>

        <section className="visits-card">
          <div className="visits-header">
            <h2>Visitas programadas</h2>
            <span style={{ fontSize: 11, color: '#7e8aa6', fontWeight: 600 }}>{pendientesHoy.length} hoy</span>
          </div>

          {pendientesHoy.length === 0 ? (
            <p style={{ fontSize: 12, color: '#7e8aa6', padding: '12px 0', textAlign: 'center' }}>
              {loading ? 'Cargando…' : 'No hay visitas programadas para hoy'}
            </p>
          ) : (
            <ul className="visits-list">
              {pendientesHoy.map((v) => (
                <li key={v.id} className="visit-item" onClick={() => abrirDetalle(v)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && abrirDetalle(v)} style={{ cursor: 'pointer' }}>
                  <div className="visit-date">
                    <span className="visit-date-label">{v.fecha === hoy ? 'Hoy' : v.fecha ?? '—'}</span>
                    <span className="visit-time">{v.hora}</span>
                  </div>
                  <div className="visit-info">
                    <span className="visit-company">{v.destino.nombre}</span>
                    <span className="visit-detail">{v.destino.subtitulo || (v.tipo === 'institucion' ? 'Institución' : 'Médico')}</span>
                  </div>
                  <span className="visit-status-badge status-pendiente">{v.tipo === 'institucion' ? 'Institución' : 'Médico'}</span>
                </li>
              ))}
            </ul>
          )}
          <button className="view-all" onClick={() => onNavigate('calendario')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 8, fontSize: 12, color: '#2d9c9c', fontWeight: 600, textAlign: 'left', padding: 0 }}>
            ver más visitas en el calendario →
          </button>
        </section>
      </div>

      {detail && (
        <div className="visit-detail-overlay" onClick={() => setDetail(null)}>
          <div className="visit-detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Detalle de ${detail.destino.nombre}`}>
            <div className="visit-detail-header">
              <span className="visit-detail-badge">{detail.hora} · {detail.fecha ?? 'Sin fecha'}</span>
              <span className="visit-detail-status">{detail.tipo === 'institucion' ? 'Institución' : 'Médico'}</span>
              <button className="visit-detail-close" onClick={() => setDetail(null)} aria-label="Cerrar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <h3 className="visit-detail-title">{detail.destino.nombre}</h3>
            <p className="visit-detail-subtitle">{detail.destino.subtitulo || (detail.tipo === 'institucion' ? 'Institución de salud' : 'Médico')}</p>
            <p className="visit-detail-addr">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7a99" strokeWidth="1.8">
                <path d="M12 21s-6-4.5-6-10a6 6 0 0 1 12 0c0 5.5-6 10-6 10z" />
                <circle cx="12" cy="11" r="2" />
              </svg>
              {detail.destino.direccion}
            </p>
            <div className="visit-detail-grid">
              <div className="visit-detail-field">
                <span className="visit-detail-label">TIPO</span>
                <span className="visit-detail-value">{detail.tipo === 'institucion' ? 'Institución' : 'Médico'}</span>
              </div>
              <div className="visit-detail-field">
                <span className="visit-detail-label">MODALIDAD</span>
                <span className="visit-detail-value">{detail.destino.particular ? 'Particular' : 'Programada'}</span>
              </div>
            </div>
            <div className="visit-detail-field">
              <span className="visit-detail-label">DESTINO</span>
              <p className="visit-detail-desc">{detail.destino.nombre} · {detail.destino.subtitulo}</p>
            </div>
            <div style={{ marginTop: 12, background: '#f8f9fb', border: '1px solid #eef1f5', borderRadius: 10, padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#1B2A4E,#2d9c9c)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {detail.destino.nombre.split(' ').filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join('').slice(0, 2)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1B2A4E' }}>{detail.destino.nombre}</div>
                <div style={{ fontSize: 11, color: '#2d9c9c' }}>{detail.destino.subtitulo || 'Médico/Institución'}</div>
                <div style={{ fontSize: 11, color: '#6b7a99' }}>{detail.destino.direccion}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                className="visit-detail-primary"
                style={{ flex: 1, background: '#F9B233', color: '#fff', border: 'none' }}
                onClick={() => {
                  const v = detail
                  setDetail(null)
                  if (onCompletar) {
                    onCompletar(visitaToACompletar(v))
                  } else {
                    onNavigate('registro')
                  }
                }}
              >
                Completar visita
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VisitadorHome