import { useState } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import './Notifications.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

type NotificationItem = {
  id: string
  title: string
  desc: string
  time: string
  variant: 'info' | 'clock' | 'alert'
  isNew: boolean
}

const NOTIFICATIONS: NotificationItem[] = []

function Icon({ variant }: { variant: NotificationItem['variant'] }) {
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
  const newCount = NOTIFICATIONS.filter((n) => n.isNew).length

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
          <span className="notification-dot" />
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate as any} currentView={currentView as any} onLogout={onLogout} />

      <div className="notifications-content">
        <div className="inbox-head">
          <h2 className="inbox-title">Bandeja de Entrada</h2>
          <span className="badge-new">{newCount} Nuevas</span>
        </div>

        {NOTIFICATIONS.length === 0 ? (
          <p style={{ fontSize: 12, color: '#7e8aa6', padding: 16, textAlign: 'center' }}>No hay notificaciones - sin datos en BD</p>
        ) : (
          <ul className="notif-list">
            {NOTIFICATIONS.map((n) => (
              <li key={n.id} className={`notif-card ${n.isNew ? 'notif-card--new' : ''}`}>
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
      </div>
    </div>
  )
}
