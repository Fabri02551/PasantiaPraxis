import { useState, useEffect, useMemo } from 'react'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import { visitadorService } from '../../../core/services/visitador.service'
import { medicoService } from '../../../core/services/medico.service'
import { ciudadService } from '../../../core/services/ciudad.service'
import { visitaService, type VisitaBE } from '../../../core/services/visita.service'
import { realizadasHoy, realizadasPorVisitador, realizadasPorSemana, realizadasPorMes } from '../../../core/utils/visitaStats'
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
  const [visitas, setVisitas] = useState<VisitaBE[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.allSettled([visitadorService.list(), medicoService.list(), ciudadService.list(), visitaService.list()])
      .then(results => {
        if (cancelled) return
        const visitadores = results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value.length : 0
        const medicos = results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value.length : 0
        const ciudades = results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value.length : 0
        const vs = results[3].status === 'fulfilled' && Array.isArray(results[3].value) ? results[3].value : []
        setVisitas(vs)
        setStats({ visitadores, medicos, ciudades, visitasHoy: realizadasHoy(vs) })
        if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) {
          const porVisitador = realizadasPorVisitador(vs)
          const list = (results[0].value as unknown as { persona_id: number; nombre: string; primer_apellido: string }[]).slice(0,5).map((v, i) => ({
            name: `${v.nombre} ${v.primer_apellido || ''}`.trim() || `Visitador ${i+1}`,
            val: porVisitador.get(v.persona_id) ?? 0,
          }))
          setVisitadoresList(list)
        }
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  const semanal = useMemo(() => realizadasPorSemana(visitas, 4), [visitas])
  const mensual = useMemo(() => realizadasPorMes(visitas, 6), [visitas])
  const totalSemana = useMemo(() => semanal.reduce((acc, b) => acc + b.count, 0), [semanal])
  
  const maxSemanal = Math.max(1, ...semanal.map(b => b.count))
  const maxMensual = Math.max(1, ...mensual.map(b => b.count))
  
  // SVG 340x140: x reparte 50→310, y mapea max→20 y 0→110.
  const puntos = semanal.map((b, i) => {
    const x = 50 + (i * (310 - 50)) / Math.max(1, semanal.length - 1)
    const y = 110 - (b.count / maxSemanal) * 90
    return `${Math.round(x)},${Math.round(y)}`
  }).join(' ')

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
              <span className="admin-kpi-badge" style={{ background: '#f4f6f9', color: '#6b7a99' }}>{loading ? 'Cargando...' : `${stats.visitasHoy} realizadas`}</span>
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
                        <div className="admin-bar-fill" style={{ width: `${r.val > 0 ? Math.min(100, 12 + (r.val / Math.max(1, ...visitadoresList.map(x => x.val))) * 88) : 6}%`, background: '#0e7490' }} />
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
                    points={puntos}
                  />
                  {/* dots */}
                  {puntos.split(' ').map((pt, i) => {
                    const [cx, cy] = pt.split(',')
                    return <circle key={i} cx={cx} cy={cy} r="4" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
                  })}
                </svg>
                <div className="admin-line-labels">{semanal.map(b => <span key={b.label}>{b.label} ({b.count})</span>)}</div>
              </div>
            </div>
          </div>

          {/* CHART ROW 2 */}
            <div className="admin-chart-card admin-chart-full">
            <div className="admin-chart-head">
              <h3 className="admin-chart-title">Resumen Mensual de Visitas</h3>
              <div className="admin-legend"><span className="admin-legend-item"><i style={{ background: '#0e9a9e' }} />Realizadas</span><span className="admin-legend-item"><i style={{ background: '#e8ecf1' }} />Sin visitas</span></div>
            </div>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#6b7a99', fontSize: 12 }}>Cargando...</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, padding: '8px 24px 4px', height: 120 }}>
                {mensual.map(b => (
                  <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1b2a4e' }}>{b.count}</span>
                    <div style={{ width: '100%', maxWidth: 44, height: 72, background: '#f1f4f8', borderRadius: 6, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ width: '100%', height: `${Math.max(3, (b.count / maxMensual) * 100)}%`, background: b.count > 0 ? '#0e9a9e' : '#e8ecf1', borderRadius: 6 }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#8a9ab5' }}>{b.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
    </AdminLayout>
  )
}

export default AdminDashboard