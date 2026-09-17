import './AdminSidebar.css'

export type AdminView = 'admin-dashboard' | 'admin-visitadores' | 'admin-graficos' | 'admin-calendario' | 'admin-laboratorios' | 'admin-instituciones' | 'admin-medicos' | 'admin-comentarios' | 'admin-notificaciones' | 'admin-perfil'

interface Props {
  currentView: AdminView
  onNavigate: (v: AdminView) => void
  onLogout: () => void
  collapsed?: boolean
}

export const AdminSidebar: React.FC<Props> = ({ currentView, onNavigate, onLogout }) => {
  const isActive = (v: AdminView) => currentView === v

  return (
    <aside className="admin-sidebar" aria-label="Navegación administrativa">
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
        <button className={`admin-nav-item ${isActive('admin-dashboard') ? 'active' : ''}`} onClick={() => onNavigate('admin-dashboard')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
          Dashboard
          {isActive('admin-dashboard') && <span className="admin-active-bar" />}
        </button>
        <button className={`admin-nav-item ${isActive('admin-visitadores') ? 'active' : ''}`} onClick={() => onNavigate('admin-visitadores')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6M23 11v2M17 11v2" /></svg>
          Visitadores
          {isActive('admin-visitadores') && <span className="admin-active-bar" />}
        </button>
        <button className={`admin-nav-item ${isActive('admin-graficos') ? 'active' : ''}`} onClick={() => onNavigate('admin-graficos')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
          Gráficos
          {isActive('admin-graficos') && <span className="admin-active-bar" />}
        </button>
        <button className={`admin-nav-item ${isActive('admin-calendario') ? 'active' : ''}`} onClick={() => onNavigate('admin-calendario')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          Calendario
          {isActive('admin-calendario') && <span className="admin-active-bar" />}
        </button>
        <button className={`admin-nav-item ${isActive('admin-laboratorios') ? 'active' : ''}`} onClick={() => onNavigate('admin-laboratorios')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3H15M10 3v5l-4 7a4 4 0 0 0 3.5 5h5a4 4 0 0 0 3.5-5l-4-7V3" /><path d="M8 14h8" /></svg>
          Laboratorio
          {isActive('admin-laboratorios') && <span className="admin-active-bar" />}
        </button>
        <button className={`admin-nav-item ${isActive('admin-instituciones') ? 'active' : ''}`} onClick={() => onNavigate('admin-instituciones')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a4 4 0 0 1 8 0v2" /><path d="M3 11h18M12 11v8" /></svg>
          Instituciones
          {isActive('admin-instituciones') && <span className="admin-active-bar" />}
        </button>
        <button className={`admin-nav-item ${isActive('admin-medicos') ? 'active' : ''}`} onClick={() => onNavigate('admin-medicos')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8l-2 2 2 2M22 12h-4" /></svg>
          Médicos
          {isActive('admin-medicos') && <span className="admin-active-bar" />}
        </button>
        <button className={`admin-nav-item ${isActive('admin-comentarios') ? 'active' : ''}`} onClick={() => onNavigate('admin-comentarios')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.38 8.38 0 0 1-1.9.5 4.48 4.48 0 0 0 1.95-2.45 8.94 8.94 0 0 1-2.83 1.08 4.48 4.48 0 0 0-7.65 3.08 12.72 12.72 0 0 1-9.23-4.68 4.48 4.48 0 0 0 1.39 5.98 4.43 4.43 0 0 1-2.03-.56v.06a4.48 4.48 0 0 0 3.6 4.4 4.52 4.52 0 0 1-2.04.08 4.48 4.48 0 0 0 4.18 3.11A8.98 8.98 0 0 1 2 19.1a12.66 12.66 0 0 0 6.86 2.01c8.25 0 12.76-6.84 12.76-12.76 0-.2 0-.4-.01-.6A9.2 9.2 0 0 0 23 6.2a8.9 8.9 0 0 1-2.6.7z" /><circle cx="12" cy="12" r="1" /></svg>
          Comentarios
          {isActive('admin-comentarios') && <span className="admin-active-bar" />}
        </button>
      </nav>

      <div className="admin-sidebar-footer">
        <div className="admin-user-card">
          <img src="https://i.pravatar.cc/100?img=12" alt="Carlos Mendoza" className="admin-user-avatar" />
          <div className="admin-user-info">
            <span className="admin-user-name">Carlos Mendoza</span>
            <span className="admin-user-role">Super Administrador</span>
          </div>
        </div>
        <button className="admin-logout" onClick={onLogout}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}
