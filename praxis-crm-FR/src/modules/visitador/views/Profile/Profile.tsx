import { useState } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import './Profile.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

type ProfileData = {
  nombre: string
  rol: string
  email: string
  telefono: string
  cargo: string
  empresa: string
  avatar: string
}

const INITIAL: ProfileData = {
  nombre: 'Carlos Mendoza',
  rol: 'Ejecutivo de Cuentas Senior',
  email: 'c.mendoza@fieldcrm.com',
  telefono: '+54 9 11 5829-1030',
  cargo: 'Supervisor de Visitas Técnicas',
  empresa: 'SaaS Solutions Latam',
  avatar: 'https://i.pravatar.cc/200?img=12',
}

export const ProfileView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [profile, setProfile] = useState<ProfileData>(INITIAL)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<ProfileData>(INITIAL)
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileData, string>>>({})
  const [saved, setSaved] = useState(false)

  const openEdit = () => {
    setForm(profile)
    setErrors({})
    setSaved(false)
    setEditOpen(true)
  }

  const closeEdit = () => setEditOpen(false)

  const validate = (): boolean => {
    const e: Partial<Record<keyof ProfileData, string>> = {}
    if (!form.nombre.trim()) e.nombre = 'Requerido'
    if (!form.rol.trim()) e.rol = 'Requerido'
    if (!form.email.trim()) e.email = 'Requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido'
    if (!form.telefono.trim()) e.telefono = 'Requerido'
    else if (form.telefono.trim().length < 8) e.telefono = 'Muy corto'
    if (!form.cargo.trim()) e.cargo = 'Requerido'
    if (!form.empresa.trim()) e.empresa = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setProfile(form)
    setSaved(true)
    setTimeout(() => {
      setEditOpen(false)
      setSaved(false)
    }, 600)
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Mi Perfil</h1>
        <button className="icon-btn notification-btn" aria-label="Notificaciones" onClick={() => onNavigate('notificaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <span className="notification-dot" />
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate as any} currentView={currentView as any} onLogout={onLogout} />

      <div className="profile-content">
        <section className="profile-card">
          <img src={profile.avatar} alt={profile.nombre} className="profile-avatar" />
          <h2 className="profile-name">{profile.nombre}</h2>
          <p className="profile-role">{profile.rol}</p>
        </section>

        <section className="profile-fields">
          <div className="field-group">
            <label className="field-label">CORREO ELECTRÓNICO</label>
            <div className="field-box">{profile.email}</div>
          </div>
          <div className="field-group">
            <label className="field-label">TELÉFONO</label>
            <div className="field-box">{profile.telefono}</div>
          </div>
          <div className="field-group">
            <label className="field-label">CARGO</label>
            <div className="field-box">{profile.cargo}</div>
          </div>
          <div className="field-group">
            <label className="field-label">EMPRESA</label>
            <div className="field-box">{profile.empresa}</div>
          </div>
        </section>

        <button className="btn-edit" onClick={openEdit}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Editar Perfil
        </button>

        <button className="btn-logout" onClick={onLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          Cerrar Sesión
        </button>
      </div>

      {editOpen && (
        <div className="profile-modal-overlay" onClick={closeEdit}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <div className="profile-modal-header">
              <h3>Editar Perfil</h3>
              <button className="modal-close" onClick={closeEdit} aria-label="Cerrar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form className="profile-modal-form" onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input className={`form-input ${errors.nombre ? 'input-error' : ''}`} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                {errors.nombre && <span className="field-error">{errors.nombre}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Rol / Título</label>
                <input className={`form-input ${errors.rol ? 'input-error' : ''}`} value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })} />
                {errors.rol && <span className="field-error">{errors.rol}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <input type="email" className={`form-input ${errors.email ? 'input-error' : ''}`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input className={`form-input ${errors.telefono ? 'input-error' : ''}`} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                {errors.telefono && <span className="field-error">{errors.telefono}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Cargo</label>
                <input className={`form-input ${errors.cargo ? 'input-error' : ''}`} value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
                {errors.cargo && <span className="field-error">{errors.cargo}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Empresa</label>
                <input className={`form-input ${errors.empresa ? 'input-error' : ''}`} value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
                {errors.empresa && <span className="field-error">{errors.empresa}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Avatar URL</label>
                <input className="form-input" value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} placeholder="https://..." />
              </div>

              {saved && <p className="profile-save-success">¡Perfil actualizado!</p>}

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeEdit}>
                  Cancelar
                </button>
                <button type="submit" className="btn-save">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
