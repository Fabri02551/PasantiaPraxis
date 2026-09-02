import { useState } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import './Notifications.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos'

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

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    title: 'Nueva visita asignada',
    desc: 'Se te ha asignado una inspección preventiva en TecnoCorp S.A. programada para hoy.',
    time: 'Hace 5 min',
    variant: 'info',
    isNew: true,
  },
  {
    id: '2',
    title: 'Recordatorio de visita',
    desc: 'Mañana a las 09:00 tienes una reunión agendada con Logística Central.',
    time: 'Hace 1h',
    variant: 'clock',
    isNew: true,
  },
  {
    id: '3',
    title: 'Urgente: Re-programación',
    desc: 'La cita con Constructora Andes se ha adelantado a las 14:30 de hoy.',
    time: 'Hace 2h',
    variant: 'alert',
    isNew: true,
  },
  {
    id: '4',
    title: 'Reporte de visita aprobado',
    desc: 'El supervisor aprobó tu último reporte de visita a Retail Plaza.',
    time: 'Ayer',
    variant: 'info',
    isNew: false,
  },
  {
    id: '5',
    title: 'Alerta de retraso',
    desc: 'Aún no registras la visita programada en Clínica San José.',
    time: 'Ayer',
    variant: 'alert',
    isNew: false,
  },
  {
    id: '6',
    title: 'Instrucciones de visita actualizadas',
    desc: 'Se agregaron nuevos planos y requerimientos para la visita de Constructora Andes.',
    time: '23 Oct',
    variant: 'info',
    isNew: false,
  },
  {
    id: '7',
    title: 'Recordatorio mensual',
    desc: 'Recuerda enviar tu firma digital de asistencia antes del fin de mes.',
    time: '20 Oct',
    variant: 'clock',
    isNew: false,
  },
]

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
      </div>
    </div>
  )
}
