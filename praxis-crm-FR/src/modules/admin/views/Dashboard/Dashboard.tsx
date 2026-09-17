import { useState, useEffect } from 'react'
import { AdminSidebar, type AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { AdminHeader } from '../../components/AdminHeader/AdminHeader'
import { visitadorService } from '../../../core/services/visitador.service'
import { medicoService } from '../../../core/services/medico.service'
import { ciudadService } from '../../../core/services/ciudad.service'
import './Dashboard.css'

interface Props {
  currentView: AdminView
  onNavigate: (v: AdminView) => void
  onLogout: () => void
}

export const AdminDashboard: React.FC<Props> = ({ currentView, onNavigate, onLogout }) => {
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState({ visitadores: 0, medicos: 0, ciudades: 0, visitasHoy: 0 })
  const [loading, setLoading] = useState(true)
  const [visitadoresList, setVisitadoresList] = useState<{ name: string; val: number }[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.allSettled([visitadorService.list(), medicoService.list(), ciudadService.list()])
      .then(results => {
        if (cancelled) return
        const visitadores = results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value.length : 0
        const medicos = results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value.length : 0
        const ciudades = results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value.length : 0
        setStats({ visitadores, medicos, ciudades, visitasHoy: 0 })
        if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) {
          const list = (results[0].value as unknown as { nombre: string; primer_apellido: string }[]).slice(0,5).map((v, i) => ({
            name: `${v.nombre} ${v.primer_apellido || ''}`.trim() || `Visitador ${i+1}`,
            val: 0,
          }))
          setVisitadoresList(list)
        }
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  return (
    <div className="admin-layout">
      <AdminSidebar currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} />
      <div className="admin-main">
        <AdminHeader searchValue={search} onSearchChange={setSearch} onNavigateNotifications={() => onNavigate('admin-notificaciones')} />

        <div className="admin-content">
          <div className="admin-welcome">
            <h2 className="admin-welcome-title">¡Bienvenido de vuelta, Administrador!</h2>
            <p className="admin-welcome-sub">Aquí está el resumen del estado de las visitas de campo para hoy.</p>
          </div>

          {/* KPI ROW - solo BD */}
          <div className="admin-kpi-row">
            <div className="admin-kpi-card">
              <div className="admin-kpi-head"><span>Visitas Hoy</span><span className="admin-kpi-dot" style={{ background: '#f59e0b' }} /></div>
              <div className="admin-kpi-value">{loading ? '—' : stats.visitasHoy}</div>
              <span className="admin-kpi-badge" style={{ background: '#f4f6f9', color: '#6b7a99' }}>{loading ? 'Cargando...' : 'Sin datos en BD'}</span>
            </div>
            <div className="admin-kpi-card">
              <div className="admin-kpi-head"><span>Total Médicos</span><span className="admin-kpi-dot" style={{ background: '#2d9c9c' }} /></div>
              <div className="admin-kpi-value">{loading ? '—' : stats.medicos}</div>
              <span className="admin-kpi-badge" style={{ background: '#f4f6f9', color: '#6b7a99' }}>{loading ? 'Cargando...' : `${stats.medicos} en BD`}</span>
            </div>
            <div className="admin-kpi-card">
              <div className="admin-kpi-head"><span>Visitadores Activos</span><span className="admin-kpi-dot" style={{ background: '#F9B233' }} /></div>
              <div className="admin-kpi-value">{loading ? '—' : stats.visitadores}</div>
              <span className="admin-kpi-badge" style={{ background: '#f4f6f9', color: '#6b7a99' }}>{loading ? 'Cargando...' : `${stats.visitadores} en BD`}</span>
            </div>
            <div className="admin-kpi-card">
              <div className="admin-kpi-head"><span>Ciudades</span><span className="admin-kpi-dot" style={{ background: '#7ed3b2' }} /></div>
              <div className="admin-kpi-value">{loading ? '—' : stats.ciudades}</div>
              <span className="admin-kpi-badge" style={{ background: '#f4f6f9', color: '#6b7a99' }}>{loading ? 'Cargando...' : `${stats.ciudades} en BD`}</span>
            </div>
          </div>

          {/* CHARTS ROW 1 */}
          <div className="admin-charts-row">
            <div className="admin-chart-card">
              <h3 className="admin-chart-title">Visitadores en BD</h3>
              <div className="admin-bar-list">
                {loading ? (
                  <p style={{ fontSize: 12, color: '#6b7a99' }}>Cargando...</p>
                ) : visitadoresList.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#6b7a99' }}>Sin visitadores en la base de datos</p>
                ) : (
                  visitadoresList.map(r => (
                    <div key={r.name} className="admin-bar-row">
                      <span className="admin-bar-name">{r.name}</span>
                      <div className="admin-bar-track">
                        <div className="admin-bar-fill" style={{ width: `${r.val > 0 ? 100 : 6}%`, background: '#0e7490' }} />
                      </div>
                      <span className="admin-bar-val">{r.val}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="admin-chart-card">
              <h3 className="admin-chart-title">Productividad de la Empresa (Visitas Semanales)</h3>
              <div className="admin-line-chart">
                <svg viewBox="0 0 340 140" className="admin-line-svg" preserveAspectRatio="none">
                  {/* grid */}
                  <line x1="40" y1="20" x2="40" y2="110" stroke="#e8ecf1" strokeWidth="1" />
                  <line x1="40" y1="110" x2="320" y2="110" stroke="#e8ecf1" strokeWidth="1" />
                  <line x1="40" y1="65" x2="320" y2="65" stroke="#f4f6f9" strokeWidth="1" />
                  {/* line */}
                  <polyline
                    fill="none"
                    stroke="#0e9a9e"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points="50,95 120,55 190,70 250,20 310,25"
                  />
                  {/* dots */}
                  <circle cx="50" cy="95" r="4" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
                  <circle cx="120" cy="55" r="4" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
                  <circle cx="190" cy="70" r="4" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
                  <circle cx="250" cy="20" r="4" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
                  <circle cx="310" cy="25" r="4" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
                </svg>
                <div className="admin-line-labels"><span>Semana 1</span><span>Semana 2</span><span>Semana 3</span><span>Semana 4</span></div>
              </div>
            </div>
          </div>

          {/* CHART ROW 2 */}
            <div className="admin-chart-card admin-chart-full">
            <div className="admin-chart-head">
              <h3 className="admin-chart-title">Resumen Mensual de Visitas</h3>
              <div className="admin-legend"><span className="admin-legend-item"><i style={{ background: '#0e9a9e' }} />Datos BD</span><span className="admin-legend-item"><i style={{ background: '#f59e0b' }} />Sin endpoint</span></div>
            </div>
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7a99', fontSize: 12 }}>Sin datos de visitas mensuales - no hay endpoint en la base de datos (tabla visitador_medico sin API)</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
