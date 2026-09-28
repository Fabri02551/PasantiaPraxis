import './SidebarMenu.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos'

interface SidebarMenuProps {
  open: boolean
  onClose: () => void
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

export const SidebarMenu: React.FC<SidebarMenuProps> = ({
  open,
  onClose,
  onNavigate,
  currentView,
  onLogout,
}) => {
  const handleNav = (view: View) => {
    onNavigate(view)
    onClose()
  }

  return (
    <div
      className={`sidebar-overlay ${open ? 'sidebar-overlay--open' : ''}`}
      onClick={onClose}
      aria-hidden={!open}
    >
      <div className="sidebar-backdrop" />
      <aside
        className={`sidebar-drawer ${open ? 'sidebar-drawer--open' : ''}`}
        onClick={(e) => e.stopPropagation()}
        aria-label="Menú de navegación"
      >
        <div className="sidebar-profile">
          <img
            src="https://i.pravatar.cc/100?img=12"
            alt="Ing. Carlos Mendoza"
            className="sidebar-avatar"
          />
          <div className="sidebar-profile-text">
            <span className="sidebar-name">Ing. Carlos Mendoza</span>
            <span className="sidebar-role">Técnico de Campo</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-item ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => handleNav('home')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 11L12 3l9 8v10a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4H9v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V11z" />
              <path d="M9 21V12h6v9" />
            </svg>
            Inicio
          </button>

          <button
            className={`sidebar-item ${currentView === 'home' ? 'active' : ''}`}
            onClick={() => handleNav('home')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Ruta del Día
          </button>

          <button
            className={`sidebar-item ${currentView === 'registro' ? 'active' : ''}`}
            onClick={() => handleNav('registro')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Registrar Visita
          </button>

          <button
            className={`sidebar-item ${currentView === 'calendario' ? 'active' : ''}`}
            onClick={() => handleNav('calendario')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            Calendario
          </button>

          <button
            className={`sidebar-item ${currentView === 'medicos' ? 'active' : ''}`}
            onClick={() => handleNav('medicos')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            Médicos
          </button>

          <button
            className={`sidebar-item ${currentView === 'planificador' ? 'active' : ''}`}
            onClick={() => handleNav('planificador')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
              <path d="M8 15h8M8 18h5" />
            </svg>
            Planificador
          </button>

          <button
            className={`sidebar-item ${currentView === 'perfil' ? 'active' : ''}`}
            onClick={() => handleNav('perfil')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 21a8 8 0 0 0-16 0" />
              <circle cx="12" cy="8" r="5" />
            </svg>
            Mi Perfil
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-logout" onClick={onLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </div>
  )
}
