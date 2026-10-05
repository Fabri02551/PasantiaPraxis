import { useEffect, useState } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { useNotificaciones, type Notificacion } from '../../hooks/useNotificaciones'
import './Notifications.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'instituciones' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

function Icon({ variant }: { variant: Notificacion['variant'] }) {
  if (variant === 'info') {
    return (
      <div className="notif-icon notif-icon--info">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2d9c9c" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </div>
    )
  }
  if (variant === 'clock') {
    return (
      <div className="notif-icon notif-icon--clock">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d48b00" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      </div>
    )
  }
  return (
    <div className="notif-icon notif-icon--alert">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e35d5d" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    </div>
  )
}

export const NotificationsView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [vistasEnSesion, setVistasEnSesion] = useState<string[]>([])
  const { notificaciones, loading, nuevas, alertas, marcarTodasVistas } = useNotificaciones()

  // Abrir la bandeja cuenta como leer las notificaciones: el punto rojo del
  // encabezado volvería a encenderse en cada navegación si no.
  useEffect(() => {
    if (loading || nuevas === 0) return
    marcarTodasVistas()
  }, [loading, nuevas, marcarTodasVistas])

  const esNueva = (n: Notificacion) => !vistasEnSesion.includes(n.id)

  const abrirVisita = (visitaId: number) => {
    // Desde la bandeja no se completa la visita (falta el formulario con
    // cotización y firma): se manda al calendario, que es donde el visitador
    // la abre.
    void visitaId
    onNavigate('calendario')
  }

  return (
    <div className="notifications-page">
      <header className="notifications-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Notificaciones</h1>
        <button className="icon-btn notification-btn" aria-label="Notificaciones">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {alertas > 0 && <span className="notification-dot" />}
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate as any} currentView={currentView as any} onLogout={onLogout} />

      <div className="notifications-content">
        <div className="inbox-head">
          <h2 className="inbox-title">Bandeja de Entrada</h2>
          {nuevas > 0 ? (
            <span className="badge-new">{nuevas} Nuevas</span>
          ) : (
            <span className="badge-new badge-new--ok">{alertas > 0 ? `${alertas} pendientes` : 'Al día'}</span>
          )}
        </div>

        {loading ? (
          <p style={{ fontSize: 12, color: '#7e8aa6', padding: 16, textAlign: 'center' }}>Cargando…</p>
        ) : notificaciones.length === 0 ? (
          <p style={{ fontSize: 12, color: '#7e8aa6', padding: 16, textAlign: 'center' }}>
            No hay nada por avisar. Cuando tengas visitas programadas aparecen aquí.
          </p>
        ) : (
          <ul className="notif-list">
            {notificaciones.map((n) => (
              <li
                key={n.id}
                className={`notif-card ${esNueva(n) ? 'notif-card--new' : ''}`}
                onClick={() => {
                  setVistasEnSesion((prev) => [...prev, n.id])
                  if (n.visitaId != null) abrirVisita(n.visitaId)
                }}
                style={n.visitaId != null ? { cursor: 'pointer' } : undefined}
              >
                <Icon variant={n.variant} />
                <div className="notif-text">
                  <div className="notif-top">
                    <span className="notif-title">{n.title}</span>
                    <span className="notif-time">{n.time}</span>
                  </div>
                  <p className="notif-desc">{n.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="notif-foot">
          Las visitas vencidas se detectan solas al pasar la hora: no hace falta registrarlas antes para
          que aparezcan aquí.
        </p>
      </div>
    </div>
  )
}