import { useState } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { ComentarioForm } from '../../../core/components/ComentarioForm/ComentarioForm'
import './Comentarios.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

export const VisitadorComentariosView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="comentarios-page">
      <header className="comentarios-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Comentarios</h1>
        <button className="icon-btn notification-btn" aria-label="Notificaciones" onClick={() => onNavigate('notificaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate as any} currentView={currentView as any} onLogout={onLogout} />

      <div className="comentarios-content">
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1B2A4E', margin: 0, letterSpacing: 0.3 }}>Enviar comentario</h2>
          <p style={{ fontSize: 11.5, color: '#7e8aa6', margin: '4px 0 0' }}>
            Tus comentarios se enviarán a <strong>danicamposdalence@gmail.com</strong> con fecha automática.
          </p>
        </div>
        <ComentarioForm roleLabel="Visitador" />
      </div>
    </div>
  )
}
