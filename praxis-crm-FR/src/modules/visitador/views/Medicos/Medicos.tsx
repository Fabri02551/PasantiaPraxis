import { useState, useMemo } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import './Medicos.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

type Medico = {
  id: string
  nombre: string
  especialidad: string
  hospital: string
}

const MEDICOS: Medico[] = [
  { id: '1', nombre: 'Dr. Roberto Garcia', especialidad: 'Cardiólogo', hospital: 'Hospital Ángeles Metropolitana' },
  { id: '2', nombre: 'Dra. María López', especialidad: 'Pediatra', hospital: 'Clínica Infantil San José' },
  { id: '3', nombre: 'Dr. Carlos Mendoza', especialidad: 'Traumatólogo', hospital: 'Centro Médico ABC' },
  { id: '4', nombre: 'Dra. Ana Sofía Ruiz', especialidad: 'Ginecóloga', hospital: 'Hospital Delta Especialidades' },
  { id: '5', nombre: 'Dr. Javier Hernández', especialidad: 'Dermatólogo', hospital: 'Clínica Médica Santa Fe' },
  { id: '6', nombre: 'Dra. Elena Gómez', especialidad: 'Neuróloga', hospital: 'Instituto Nacional de Neurología' },
]

export const MedicosView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return MEDICOS
    return MEDICOS.filter(
      (m) => m.nombre.toLowerCase().includes(q) || m.especialidad.toLowerCase().includes(q) || m.hospital.toLowerCase().includes(q),
    )
  }, [search])

  return (
    <div className="medicos-page">
      <header className="medicos-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Médicos</h1>
        <button className="icon-btn notification-btn" aria-label="Notificaciones" onClick={() => onNavigate('notificaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate as any} currentView={currentView as any} onLogout={onLogout} />

      <div className="medicos-content">
        <div className="medicos-search-wrap">
          <svg className="medicos-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a9ab5" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            className="medicos-search-input"
            placeholder="Buscar médico o especialidad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="medicos-subheader">
          <span className="medicos-subtitle">Todos los médicos registrados</span>
          <span className="medicos-count">{filtered.length} resultados</span>
        </div>

        <ul className="medicos-list">
          {filtered.map((m) => (
            <li key={m.id} className="medico-card">
              <div className="medico-info">
                <span className="medico-nombre">{m.nombre}</span>
                <span className="medico-especialidad">{m.especialidad}</span>
                <span className="medico-hospital">
                  <span className="medico-hospital-dot" />
                  {m.hospital}
                </span>
              </div>
              <div className="medico-actions">
                <button className="btn-ver" onClick={() => console.log('Ver', m.id)}>Ver</button>
                <button className="btn-editar" onClick={() => console.log('Editar', m.id)}>Editar</button>
              </div>
            </li>
          ))}
        </ul>

        {filtered.length === 0 && <p className="medicos-empty">No se encontraron médicos</p>}
      </div>
    </div>
  )
}

export const VisitadorMedicos = MedicosView
