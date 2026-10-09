import { useState, useEffect } from 'react'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import { visitadorService } from '../../../core/services/visitador.service'
import { medicoService } from '../../../core/services/medico.service'
import { ciudadService } from '../../../core/services/ciudad.service'
import { visitaService } from '../../../core/services/visita.service'
import type { VisitaBE } from '../../../core/services/visita.service'
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
  const [visitasSemana, setVisitasSemana] = useState<number[]>([0, 0, 0, 0])
  const [semanaLabels, setSemanaLabels] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.allSettled([visitadorService.list(), medicoService.list(), ciudadService.list(), visitaService.list()])
      .then(results => {
        if (cancelled) return
        const visitadores = results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value.length : 0
        const medicos = results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value.length : 0
        const ciudades = results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value.length : 0
        const visitas = results[3].status === 'fulfilled' && Array.isArray(results[3].value) ? (results[3].value as VisitaBE[]) : []

        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)
        const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

        const conFecha = visitas.filter(v => v.fecha_visita)
        const visitasHoy = conFecha.filter(v => {
          const d = new Date(v.fecha_visita as string)
          return d >= hoy && d < new Date(hoy.getTime() + 86400000)
        }).length
        setStats({ visitadores, medicos, ciudades, visitasHoy })

        // Ventanas de 7 días que terminan hoy, de la más vieja a la más nueva.
        const semanas = [3, 2, 1, 0].map(i => {
          const fin = new Date(hoy.getTime() - i * 7 * 86400000 + 86399999)
          const ini = new Date(hoy.getTime() - (i * 7 + 6) * 86400000)
          return { ini, fin }
        })
        setVisitasSemana(semanas.map(s => conFecha.filter(v => {
          const d = new Date(v.fecha_visita as string)
          return d >= s.ini && d <= s.fin
        }).length))
        setSemanaLabels(semanas.map(s => `${fmt(s.ini)}–${fmt(new Date(s.fin.getTime() - 86399999))}`))

        // Top 5 visitadores por visitas registradas.
        const porVisitador = new Map<number, number>()
        conFecha.forEach(v => porVisitador.set(v.id_visitador, (porVisitador.get(v.id_visitador) || 0) + 1))
        if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) {
          const list = (results[0].value as unknown as { persona_id: number; nombre: string; primer_apellido: string }[])
            .map(v => ({
              name: `${v.nombre} ${v.primer_apellido || ''}`.trim() || 'Visitador',
              val: porVisitador.get(v.persona_id) || 0,
            }))
            .sort((a, b) => b.val - a.val)
            .slice(0, 5)
          setVisitadoresList(list)
        }
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  const maxSemana = Math.max(1, ...visitasSemana)
  const totalSemana = visitasSemana.reduce((a, b) => a + b, 0)
  const pts = visitasSemana.map((c, i) => ({ x: 50 + i * 70, y: 110 - (c / maxSemana) * 90, c }))
  const maxVisitas = Math.max(1, ...visitadoresList.map(r => r.val))

  return (
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Panel de Control" searchValue={search} onSearchChange={setSearch}>
        <div className="admin-content" style={{ padding: 0 }}>
          <div className="admin-welcome">
            <h2 className="admin-welcome-title">¡Bienvenido de vuelta, Administrador!</h2>
            <p className="admin-welcome-sub">Aquí está el resumen del estado de las visitas de campo para hoy.</p>
          </div>

          {/* KPI ROW - solo BD */}
          <div className="admin-kpi-row">
            <div className="admin-kpi-card">
              <div className="admin-kpi-head"><span>Visitas Hoy</span><span className="admin-kpi-dot" style={{ background: '#f59e0b' }} /></div>
              <div className="admin-kpi-value">{loading ? '—' : stats.visitasHoy}</div>
              <span className="admin-kpi-badge" style={{ background: '#f4f6f9', color: '#6b7a99' }}>{loading ? 'Cargando...' : `${stats.visitasHoy} hoy`}</span>
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
              <h3 className="admin-chart-title">Top Visitadores (visitas registradas)</h3>
              <div className="admin-bar-list">
                {loading ? (
                  <p style={{ fontSize: 12, color: '#6b7a99' }}>Cargando...</p>
                ) : visitadoresList.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#6b7a99' }}>Sin visitadores</p>
                ) : totalSemana === 0 && visitadoresList.every(r => r.val === 0) ? (
                  <p style={{ fontSize: 12, color: '#6b7a99' }}>Sin visitas registradas todavía</p>
                ) : (
                  visitadoresList.map((r, i) => (
                    <div key={i} className="admin-bar-row">
                      <span className="admin-bar-name">{r.name}</span>
                      <div className="admin-bar-track">
                        <div className="admin-bar-fill" style={{ width: `${r.val > 0 ? Math.max(8, (r.val / maxVisitas) * 100) : 0}%`, background: '#0e7490' }} />
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
                {totalSemana === 0 && !loading && (
                  <p style={{ fontSize: 12, color: '#6b7a99', textAlign: 'center' }}>Sin visitas registradas en las últimas 4 semanas</p>
                )}
                <svg viewBox="0 0 340 140" className="admin-line-svg" preserveAspectRatio="none">
                  {/* grid */}
                  <line x1="40" y1="20" x2="40" y2="110" stroke="#e8ecf1" strokeWidth="1" />
                  <line x1="40" y1="110" x2="320" y2="110" stroke="#e8ecf1" strokeWidth="1" />
                  <line x1="40" y1="65" x2="320" y2="65" stroke="#f4f6f9" strokeWidth="1" />
                  {/* línea y puntos calculados desde /api/visitas */}
                  <polyline
                    fill="none"
                    stroke="#0e9a9e"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={pts.map(p => `${p.x},${p.y}`).join(' ')}
                  />
                  {pts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="4" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
                  ))}
                </svg>
                <div className="admin-line-labels">
                  {semanaLabels.map(l => <span key={l}>{l}</span>)}
                </div>
              </div>
            </div>
          </div>

          {/* CHART ROW 2 */}
            <div className="admin-chart-card admin-chart-full">
            <div className="admin-chart-head">
              <h3 className="admin-chart-title">Resumen Mensual de Visitas</h3>
              <div className="admin-legend"><span className="admin-legend-item"><i style={{ background: '#0e9a9e' }} />Con datos</span><span className="admin-legend-item"><i style={{ background: '#f59e0b' }} />Sin datos</span></div>
            </div>
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7a99', fontSize: 12 }}>Sin datos de visitas mensuales</div>
          </div>
        </div>
    </AdminLayout>
  )
}

export default AdminDashboard
