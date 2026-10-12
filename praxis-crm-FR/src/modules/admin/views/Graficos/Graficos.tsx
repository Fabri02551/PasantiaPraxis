import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { visitadorService, type VisitadorBE } from '../../../core/services/visitador.service'
import { visitaService, type VisitaBE } from '../../../core/services/visita.service'
import { esRealizada, realizadasPorVisitador, realizadasPorSemana } from '../../../core/utils/visitaStats'
import './Graficos.css'

interface Props {
  currentView: AdminView
  onNavigate: (v: AdminView) => void
  onLogout: () => void
}

const nombreVisitador = (v: VisitadorBE) =>
  [v.nombre, v.primer_apellido, v.segundo_apellido].filter(Boolean).join(' ').trim() || v.correo

export const GraficosView: React.FC<Props> = ({ currentView, onNavigate, onLogout }) => {
  const [visitadores, setVisitadores] = useState<VisitadorBE[]>([])
  const [visitas, setVisitas] = useState<VisitaBE[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([visitadorService.list(), visitaService.list()]).then(([rt, rs]) => {
      if (cancelled) return
      if (rt.status === 'fulfilled' && Array.isArray(rt.value)) setVisitadores(rt.value)
      if (rs.status === 'fulfilled' && Array.isArray(rs.value)) setVisitas(rs.value)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const porVisitador = useMemo(() => realizadasPorVisitador(visitas), [visitas])
  const filas = useMemo(
    () => visitadores
      .map((v) => ({ name: nombreVisitador(v), val: porVisitador.get(v.persona_id) ?? 0 }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 8),
    [visitadores, porVisitador],
  )
  const maxFila = Math.max(1, ...filas.map((f) => f.val))
  const semanal = useMemo(() => realizadasPorSemana(visitas, 4), [visitas])
  const maxSemanal = Math.max(1, ...semanal.map((b) => b.count))
  const realizadas = useMemo(() => visitas.filter(esRealizada).length, [visitas])
  const programadas = visitas.length - realizadas
  const extraordinarias = useMemo(
    () => visitas.filter((v) => v.extraordinaria === true).length,
    [visitas],
  )

  return (
  <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Gráficos y Estadísticas">
    <div className="graficos-intro">
      <h2 className="graficos-title">Analítica Avanzada de Visitas</h2>
      <p className="graficos-sub">Visualiza el rendimiento de la operación.</p>
    </div>

    <div className="graficos-grid">
      <div className="graficos-card">
        <h3 className="graficos-card-title">Visitas realizadas por visitador</h3>
        <div className="graficos-bars">
          {loading ? (
            <p style={{ fontSize: 12, color: '#6b7a99' }}>Cargando...</p>
          ) : filas.length === 0 ? (
            <p style={{ fontSize: 12, color: '#6b7a99' }}>Sin visitadores</p>
          ) : (
            filas.map(r => (
              <div key={r.name} className="graficos-bar-row">
                <span className="graficos-bar-name">{r.name}</span>
                <div className="graficos-bar-track">
                  <div className="graficos-bar-fill" style={{ width: `${r.val > 0 ? Math.max(8, (r.val / maxFila) * 100) : 4}%`, background: '#0e9a9e' }} />
                </div>
                <span className="graficos-bar-pct">{r.val}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="graficos-card">
        <h3 className="graficos-card-title">Productividad Semanal</h3>
        {loading ? (
          <p style={{ fontSize: 12, color: '#6b7a99' }}>Cargando...</p>
        ) : (
          <div className="graficos-line-wrap">
            <svg viewBox="0 0 340 130" className="graficos-line-svg" preserveAspectRatio="none">
              <line x1="30" y1="10" x2="30" y2="105" stroke="#e8ecf1" strokeWidth="1" />
              <line x1="30" y1="105" x2="325" y2="105" stroke="#e8ecf1" strokeWidth="1" />
              <polyline
                fill="none"
                stroke="#0e9a9e"
                strokeWidth="2.2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={semanal.map((b, i) => {
                  const x = 40 + (i * (320 - 40)) / Math.max(1, semanal.length - 1)
                  const y = 105 - (b.count / maxSemanal) * 90
                  return `${Math.round(x)},${Math.round(y)}`
                }).join(' ')}
              />
              {semanal.map((b, i) => {
                const x = 40 + (i * (320 - 40)) / Math.max(1, semanal.length - 1)
                const y = 105 - (b.count / maxSemanal) * 90
                return <circle key={b.label} cx={Math.round(x)} cy={Math.round(y)} r="4" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
              })}
            </svg>
            <div className="graficos-line-labels">
              {semanal.map((b) => <span key={b.label}>{b.label} ({b.count})</span>)}
            </div>
          </div>
        )}
      </div>

      <div className="graficos-card">
        <h3 className="graficos-card-title">Totales</h3>
        {loading ? (
          <p style={{ fontSize: 12, color: '#6b7a99' }}>Cargando...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Visitas realizadas', val: realizadas, color: '#0e9a9e' },
              { label: 'Programadas pendientes', val: programadas, color: '#f59e0b' },
              { label: 'Extraordinarias', val: extraordinarias, color: '#7c3aed' },
            ].map((t) => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: '#1b2a4e' }}>{t.label}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#1b2a4e' }}>{t.val}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </AdminLayout>
  )
}
