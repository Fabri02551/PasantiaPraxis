import './SidebarMenu.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'instituciones' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

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
            Visita Extraordinaria
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
            className={`sidebar-item ${currentView === 'instituciones' ? 'active' : ''}`}
            onClick={() => handleNav('instituciones')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 21h18M5 21V8l7-5 7 5v13M10 21v-4h4v4" />
              <path d="M9 10h1M14 10h1M9 14h1M14 14h1" />
            </svg>
            Instituciones
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

          <button
            className={`sidebar-item ${currentView === 'comentarios' ? 'active' : ''}`}
            onClick={() => handleNav('comentarios')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 11.5a8.38 8.38 0 0 1-1.9.5 4.48 4.48 0 0 0 1.95-2.45 8.94 8.94 0 0 1-2.83 1.08 4.48 4.48 0 0 0-7.65 3.08 12.72 12.72 0 0 1-9.23-4.68 4.48 4.48 0 0 0 1.39 5.98 4.43 4.43 0 0 1-2.03-.56v.06a4.48 4.48 0 0 0 3.6 4.4 4.52 4.52 0 0 1-2.04.08 4.48 4.48 0 0 0 4.18 3.11A8.98 8.98 0 0 1 2 19.1a12.66 12.66 0 0 0 6.86 2.01c8.25 0 12.76-6.84 12.76-12.76 0-.2 0-.4-.01-.6A9.2 9.2 0 0 0 23 6.2a8.9 8.9 0 0 1-2.6.7z" />
            </svg>
            Comentarios
          </button>

          <button
            className={`sidebar-item ${currentView === 'historial' ? 'active' : ''}`}
            onClick={() => handleNav('historial')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M10 13H8M16 17H8M13 13h2" />
            </svg>
            Historial
          </button>

          <button
            className={`sidebar-item ${currentView === 'cartera' ? 'active' : ''}`}
            onClick={() => handleNav('cartera')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="7" width="20" height="15" rx="2" />
              <path d="M16 11a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2" />
              <path d="M2 12h16" />
            </svg>
            Cartera
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
