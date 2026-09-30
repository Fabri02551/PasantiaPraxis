import { useCallback, useEffect, useState } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { authService, type CurrentUser } from '../../../auth/services/auth.service'
import './Profile.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'instituciones' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

type ProfileForm = {
  nombre: string
  primer_apellido: string
  segundo_apellido: string
  sexo: string
  telefono: string
  nacimiento: string
  ci: string
}

const EMPTY_FORM: ProfileForm = {
  nombre: '',
  primer_apellido: '',
  segundo_apellido: '',
  sexo: '',
  telefono: '',
  nacimiento: '',
  ci: '',
}

const AVATAR_FALLBACK = 'https://i.pravatar.cc/200?img=12'

const ROLE_LABEL: Record<string, string> = {
  visitador: 'Visitador',
  admin: 'Administrador',
}

const SEXO_LABEL: Record<string, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
  otro: 'Otro',
  m: 'Masculino',
  f: 'Femenino',
  o: 'Otro',
}

const fullName = (u: CurrentUser) =>
  [u.nombre, u.primer_apellido, u.segundo_apellido].filter(Boolean).join(' ').trim()

const roleLabel = (role: string) => ROLE_LABEL[role] ?? role ?? '—'

const sexoLabel = (sexo: string) => SEXO_LABEL[sexo.toLowerCase()] ?? sexo

// persona.nacimiento es DATE: el backend lo devuelve como RFC3339 y el
// <input type="date"> necesita yyyy-mm-dd.
const toDateInput = (value: string | null) => (value ? value.slice(0, 10) : '')

const formatDate = (value: string | null) => {
  if (!value) return '—'
  const iso = toDateInput(value)
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

const toForm = (u: CurrentUser): ProfileForm => ({
  nombre: u.nombre ?? '',
  primer_apellido: u.primer_apellido ?? '',
  segundo_apellido: u.segundo_apellido ?? '',
  sexo: u.sexo ?? '',
  telefono: u.telefono ?? '',
  nacimiento: toDateInput(u.nacimiento),
  ci: u.ci ?? '',
})

export const ProfileView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [profile, setProfile] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileForm, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setProfile(await authService.getMe())
    } catch (err) {
      setProfile(null)
      setLoadError(err instanceof Error ? err.message : 'No se pudo cargar el perfil')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openEdit = () => {
    if (!profile) return
    setForm(toForm(profile))
    setErrors({})
    setSaveError(null)
    setSaved(false)
    setEditOpen(true)
  }

  const closeEdit = () => {
    if (saving) return
    setEditOpen(false)
  }

  const validate = (): boolean => {
    const e: Partial<Record<keyof ProfileForm, string>> = {}
    if (!form.nombre.trim()) e.nombre = 'Requerido'
    if (!form.primer_apellido.trim()) e.primer_apellido = 'Requerido'
    if (form.telefono.trim() && form.telefono.trim().length < 8) e.telefono = 'Muy corto'
    if (form.nacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(form.nacimiento)) e.nacimiento = 'Fecha inválida'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || saving) return

    setSaving(true)
    setSaveError(null)
    try {
      const updated = await authService.updateMe({
        nombre: form.nombre.trim(),
        primer_apellido: form.primer_apellido.trim(),
        segundo_apellido: form.segundo_apellido.trim() || null,
        sexo: form.sexo,
        telefono: form.telefono.trim(),
        // yyyy-mm-dd: la columna es DATE y no debe recibir un timestamptz.
        nacimiento: form.nacimiento || null,
        ci: form.ci.trim(),
      })
      setProfile(updated)
      setSaved(true)
      setTimeout(() => {
        setEditOpen(false)
        setSaved(false)
      }, 700)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar el perfil')
    } finally {
      setSaving(false)
    }
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
        {loading ? (
          <p className="profile-status">Cargando tus datos…</p>
        ) : loadError || !profile ? (
          <div className="profile-error">
            <p className="profile-status profile-status-error">{loadError ?? 'No se encontró el perfil'}</p>
            <button className="btn-retry" onClick={() => void load()}>
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <section className="profile-card">
              <img src={AVATAR_FALLBACK} alt={fullName(profile) || 'Perfil'} className="profile-avatar" />
              <h2 className="profile-name">{fullName(profile) || 'Sin nombre'}</h2>
              <p className="profile-role">{roleLabel(profile.role)}</p>
            </section>

            <section className="profile-fields">
              <div className="field-group">
                <label className="field-label">CORREO ELECTRÓNICO</label>
                <div className="field-box">{profile.email || '—'}</div>
              </div>
              <div className="field-group">
                <label className="field-label">TELÉFONO</label>
                <div className="field-box">{profile.telefono || '—'}</div>
              </div>
              <div className="field-group">
                <label className="field-label">CÉDULA</label>
                <div className="field-box">{profile.ci || '—'}</div>
              </div>
              <div className="field-group">
                <label className="field-label">SEXO</label>
                <div className="field-box">{profile.sexo ? sexoLabel(profile.sexo) : '—'}</div>
              </div>
              <div className="field-group">
                <label className="field-label">FECHA DE NACIMIENTO</label>
                <div className="field-box">{formatDate(profile.nacimiento)}</div>
              </div>
              <div className="field-group">
                <label className="field-label">ROL</label>
                <div className="field-box">{roleLabel(profile.role)}</div>
              </div>
            </section>
          </>
        )}

        {profile && !loading && (
          <button className="btn-edit" onClick={openEdit}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Editar Perfil
          </button>
        )}

        <button className="btn-logout" onClick={onLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          Cerrar Sesión
        </button>
      </div>

      {editOpen && profile && (
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
                <label className="form-label">Correo electrónico</label>
                <input className="form-input" value={profile.email} disabled />
                <span className="form-hint">Es tu usuario de acceso y no se puede cambiar aquí.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input className={`form-input ${errors.nombre ? 'input-error' : ''}`} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                {errors.nombre && <span className="field-error">{errors.nombre}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Primer apellido</label>
                <input className={`form-input ${errors.primer_apellido ? 'input-error' : ''}`} value={form.primer_apellido} onChange={(e) => setForm({ ...form, primer_apellido: e.target.value })} />
                {errors.primer_apellido && <span className="field-error">{errors.primer_apellido}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Segundo apellido</label>
                <input className="form-input" value={form.segundo_apellido} onChange={(e) => setForm({ ...form, segundo_apellido: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Sexo</label>
                <select className="form-input" value={form.sexo} onChange={(e) => setForm({ ...form, sexo: e.target.value })}>
                  <option value="">Sin especificar</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input className={`form-input ${errors.telefono ? 'input-error' : ''}`} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                {errors.telefono && <span className="field-error">{errors.telefono}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Cédula</label>
                <input className="form-input" value={form.ci} onChange={(e) => setForm({ ...form, ci: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha de nacimiento</label>
                <input type="date" className={`form-input ${errors.nacimiento ? 'input-error' : ''}`} value={form.nacimiento} onChange={(e) => setForm({ ...form, nacimiento: e.target.value })} />
                {errors.nacimiento && <span className="field-error">{errors.nacimiento}</span>}
              </div>

              {saveError && <p className="profile-save-error">{saveError}</p>}
              {saved && <p className="profile-save-success">¡Perfil actualizado!</p>}

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeEdit} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
