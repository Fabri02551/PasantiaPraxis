import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { ComentarioForm } from '../../../core/components/ComentarioForm/ComentarioForm'

interface Props {
  currentView: AdminView
  onNavigate: (v: AdminView) => void
  onLogout: () => void
}

export const AdminComentariosView: React.FC<Props> = ({ currentView, onNavigate, onLogout }) => {
  return (
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Comentarios">
      <div style={{ maxWidth: 640 }}>
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1B2A4E', margin: 0, letterSpacing: 0.3 }}>Enviar comentario</h2>
          <p style={{ fontSize: 11.5, color: '#7e8aa6', margin: '4px 0 0' }}>
            Tus comentarios se enviarán a <strong>danicamposdalence@gmail.com</strong> con fecha automática y categoría.
          </p>
        </div>
        <ComentarioForm roleLabel="Administrador" />
      </div>
    </AdminLayout>
  )
}
