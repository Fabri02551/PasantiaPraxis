import { AdminSidebar, type AdminView } from '../AdminSidebar/AdminSidebar'
import { AdminHeader } from '../AdminHeader/AdminHeader'
import './AdminLayout.css'

interface Props {
  currentView: AdminView
  onNavigate: (v: AdminView) => void
  onLogout: () => void
  title?: string
  searchValue?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  children: React.ReactNode
}

export const AdminLayout: React.FC<Props> = ({ currentView, onNavigate, onLogout, title, searchValue, onSearchChange, searchPlaceholder, children }) => {
  return (
    <div className="admin-layout">
      <AdminSidebar currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} />
      <div className="admin-main">
        <AdminHeader title={title} searchValue={searchValue} onSearchChange={onSearchChange} searchPlaceholder={searchPlaceholder} />
        <div className="admin-content">{children}</div>
      </div>
    </div>
  )
}
