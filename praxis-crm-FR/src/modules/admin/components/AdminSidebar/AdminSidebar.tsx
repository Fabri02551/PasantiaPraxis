import { useEffect, useState } from 'react'
import { authService, type CurrentUser } from '../../../auth/services/auth.service'
import { storage } from '../../../core/lib/storage'
import { getInitials, avatarStyle } from '../../../core/utils/avatar'
import './AdminSidebar.css'

export type AdminView = 'admin-dashboard' | 'admin-visitadores' | 'admin-administradores' | 'admin-graficos' | 'admin-calendario' | 'admin-laboratorios' | 'admin-instituciones' | 'admin-medicos' | 'admin-especialidades' | 'admin-comentarios' | 'admin-notificaciones' | 'admin-perfil'

interface Props {
  currentView: AdminView
  onNavigate: (v: AdminView) => void
  onLogout: () => void
  collapsed?: boolean
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

export const AdminSidebar: React.FC<Props> = ({ currentView, onNavigate, onLogout, mobileOpen = false, onCloseMobile }) => {
  const isActive = (v: AdminView) => currentView === v
  const [me, setMe] = useState<CurrentUser | null>(null)

  useEffect(() => {
    let cancelled = false
    authService.getMe().then(u => { if (!cancelled) setMe(u) }).catch(() => { if (!cancelled) setMe(null) })
    return () => { cancelled = true }
  }, [])

  const stored = storage.getUser() as { email?: string; role?: string } | null
  const nombre = me?.nombre || 'Daniel'
  const primerApellido = me?.primer_apellido || 'Campos'
  const segundoApellido = me?.segundo_apellido || 'Dalence'
  const displayName = `${nombre} ${primerApellido}`.trim()
  const role = me?.role || stored?.role || 'admin'
  const roleLabel = role === 'admin' ? 'Super Administrador' : 'Visitador'
  const initials = getInitials(nombre, primerApellido, segundoApellido)

  const go = (v: AdminView) => {
    onNavigate(v)
    onCloseMobile?.()
  }

  return (
    <>
      {mobileOpen && <div className="admin-sidebar-backdrop" onClick={onCloseMobile} aria-hidden />}
      <aside className={`admin-sidebar ${mobileOpen ? 'admin-sidebar--open' : ''}`} aria-label="Navegación administrativa">
      <div className="admin-sidebar-brand">
        <div className="admin-brand-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#1B2A4E" aria-hidden>
            <rect x="2" y="7" width="20" height="12" rx="2" />
            <path d="M8 7V5.2C8 4.1 8.9 3.2 10 3.2h4c1.1 0 2 .9 2 2V7" fill="none" stroke="#1B2A4E" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <div className="admin-brand-text">
          <span className="admin-brand-title">Praxis</span>
          <span className="admin-brand-subtitle">Panel administrativo</span>
        </div>
      </div>

      <nav className="admin-sidebar-nav">
        <button className={`admin-nav-item ${isActive('admin-dashboard') ? 'active' : ''}`} onClick={() => go('admin-dashboard')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
          <span className="admin-nav-text">Dashboard</span>
          {isActive('admin-dashboard') && <span className="admin-active-bar" />}
        </button>
        <button className={`admin-nav-item ${isActive('admin-visitadores') ? 'active' : ''}`} onClick={() => go('admin-visitadores')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6M23 11v2M17 11v2" /></svg>
          <span className="admin-nav-text">Visitadores</span>
          {isActive('admin-visitadores') && <span className="admin-active-bar" />}
        </button>
        <button className={`admin-nav-item ${isActive('admin-administradores') ? 'active' : ''}`} onClick={() => go('admin-administradores')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
          <span className="admin-nav-text">Administradores</span>
          {isActive('admin-administradores') && <span className="admin-active-bar" />}
        </button>
        <button className={`admin-nav-item ${isActive('admin-graficos') ? 'active' : ''}`} onClick={() => go('admin-graficos')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
          <span className="admin-nav-text">Gráficos</span>
          {isActive('admin-graficos') && <span className="admin-active-bar" />}
        </button>
        <button className={`admin-nav-item ${isActive('admin-calendario') ? 'active' : ''}`} onClick={() => go('admin-calendario')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          <span className="admin-nav-text">Calendario</span>
          {isActive('admin-calendario') && <span className="admin-active-bar" />}
        </button>
        <button className={`admin-nav-item ${isActive('admin-laboratorios') ? 'active' : ''}`} onClick={() => go('admin-laboratorios')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3H15M10 3v5l-4 7a4 4 0 0 0 3.5 5h5a4 4 0 0 0 3.5-5l-4-7V3" /><path d="M8 14h8" /></svg>
          <span className="admin-nav-text">Laboratorio</span>
          {isActive('admin-laboratorios') && <span className="admin-active-bar" />}
        </button>
        <button className={`admin-nav-item ${isActive('admin-instituciones') ? 'active' : ''}`} onClick={() => go('admin-instituciones')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a4 4 0 0 1 8 0v2" /><path d="M3 11h18M12 11v8" /></svg>
          <span className="admin-nav-text">Instituciones</span>
          {isActive('admin-instituciones') && <span className="admin-active-bar" />}
        </button>
        <button className={`admin-nav-item ${isActive('admin-medicos') ? 'active' : ''}`} onClick={() => go('admin-medicos')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8l-2 2 2 2M22 12h-4" /></svg>
          <span className="admin-nav-text">Médicos</span>
          {isActive('admin-medicos') && <span className="admin-active-bar" />}
        </button>
        <button className={`admin-nav-item ${isActive('admin-especialidades') ? 'active' : ''}`} onClick={() => go('admin-especialidades')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
          <span className="admin-nav-text">Especialidades</span>
          {isActive('admin-especialidades') && <span className="admin-active-bar" />}
        </button>
        <button className={`admin-nav-item ${isActive('admin-comentarios') ? 'active' : ''}`} onClick={() => go('admin-comentarios')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.38 8.38 0 0 1-1.9.5 4.48 4.48 0 0 0 1.95-2.45 8.94 8.94 0 0 1-2.83 1.08 4.48 4.48 0 0 0-7.65 3.08 12.72 12.72 0 0 1-9.23-4.68 4.48 4.48 0 0 0 1.39 5.98 4.43 4.43 0 0 1-2.03-.56v.06a4.48 4.48 0 0 0 3.6 4.4 4.52 4.52 0 0 1-2.04.08 4.48 4.48 0 0 0 4.18 3.11A8.98 8.98 0 0 1 2 19.1a12.66 12.66 0 0 0 6.86 2.01c8.25 0 12.76-6.84 12.76-12.76 0-.2 0-.4-.01-.6A9.2 9.2 0 0 0 23 6.2a8.9 8.9 0 0 1-2.6.7z" /><circle cx="12" cy="12" r="1" /></svg>
          <span className="admin-nav-text">Comentarios</span>
          {isActive('admin-comentarios') && <span className="admin-active-bar" />}
        </button>
      </nav>

      <div className="admin-sidebar-footer">
        <div className="admin-user-card">
          <span className="admin-user-avatar admin-user-avatar--initials" style={avatarStyle(displayName)} aria-hidden>
            {initials}
          </span>
          <div className="admin-user-info">
            <span className="admin-user-name">{displayName}</span>
            <span className="admin-user-role">{roleLabel}</span>
          </div>
        </div>
        <button className="admin-logout" onClick={onLogout}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
          <span className="admin-logout-text">Cerrar Sesión</span>
        </button>
      </div>
    </aside>
    </>
  )
}
