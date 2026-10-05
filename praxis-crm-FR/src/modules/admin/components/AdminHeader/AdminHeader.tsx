import { useState } from 'react'
import './AdminHeader.css'

interface Props {
  title?: string
  onNavigateNotifications?: () => void
  searchValue?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  onMenu?: () => void
}

function formatFechaActual(date: Date) {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return `${dias[date.getDay()]}, ${date.getDate()} ${meses[date.getMonth()]}`
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

function NotifIcon({ variant }: { variant: NotificationItem['variant'] }) {
  if (variant === 'info')
    return (
      <div className="admin-notif-icon admin-notif-icon--info">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2d9c9c" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </div>
    )
  if (variant === 'clock')
    return (
      <div className="admin-notif-icon admin-notif-icon--clock">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d48b00" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      </div>
    )
  return (
    <div className="admin-notif-icon admin-notif-icon--alert">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e35d5d" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    </div>
  )
}

export const AdminHeader: React.FC<Props> = ({ title = 'Panel de Control', searchValue, onSearchChange, searchPlaceholder = 'Buscar visitas, técnicos, labs...', onMenu }) => {
  const [showNotif, setShowNotif] = useState(false)
  const fechaTexto = formatFechaActual(new Date())
  const newCount = NOTIFICATIONS.filter(n => n.isNew).length

  return (
    <header className="admin-header">
      <div className="admin-header-left">
        {onMenu && (
          <button className="admin-menu-btn" onClick={onMenu} aria-label="Abrir menú">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        )}
        <h1 className="admin-header-title">{title}</h1>
      </div>

      <div className="admin-header-right">
        <div className="admin-search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7e8aa6" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20L16 16" />
          </svg>
          <input className="admin-search-input" placeholder={searchPlaceholder} value={searchValue ?? ''} onChange={e => onSearchChange?.(e.target.value)} />
        </div>

        <button className="admin-icon-btn" onClick={() => setShowNotif(v => !v)} aria-label="Notificaciones">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B2A4E" strokeWidth="1.8">
            <path d="M6 13c0 3-2 4-2 4h16s-2-1-2-4V9a6 6 0 0 0-12 0v4z" />
            <path d="M10 18a2 2 0 0 0 4 0" />
          </svg>
          {newCount > 0 && <span className="admin-notif-dot" />}
        </button>

        <span className="admin-header-sep" aria-hidden />

        <div className="admin-date-display">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2d9c9c" strokeWidth="1.8">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span>{fechaTexto}</span>
        </div>
      </div>

      {showNotif && (
        <div className="admin-notif-overlay" onClick={() => setShowNotif(false)}>
          <div className="admin-notif-popup" onClick={e => e.stopPropagation()} role="dialog" aria-modal aria-label="Notificaciones">
            <div className="admin-notif-popup-head">
              <h3>Notificaciones</h3>
              <button className="admin-notif-close" onClick={() => setShowNotif(false)} aria-label="Cerrar notificaciones">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="admin-notif-inbox-head">
              <span className="admin-notif-inbox-title">Bandeja de Entrada</span>
              <span className="admin-notif-badge">{newCount} Nuevas</span>
            </div>
            <ul className="admin-notif-list">
              {NOTIFICATIONS.map(n => (
                <li key={n.id} className={`admin-notif-card ${n.isNew ? 'admin-notif-card--new' : ''}`}>
                  <NotifIcon variant={n.variant} />
                  <div className="admin-notif-text">
                    <div className="admin-notif-top">
                      <span className="admin-notif-title">{n.title}</span>
                      <span className="admin-notif-time">{n.time}</span>
                    </div>
                    <p className="admin-notif-desc">{n.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </header>
  )
}
