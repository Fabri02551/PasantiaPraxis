import { useState, useEffect } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { visitadorService } from '../../../core/services/visitador.service'
import './Graficos.css'

interface Props {
  currentView: AdminView
  onNavigate: (v: AdminView) => void
  onLogout: () => void
}

export const GraficosView: React.FC<Props> = ({ currentView, onNavigate, onLogout }) => {
  const [visitadores, setVisitadores] = useState<{ name: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    visitadorService.list().then(data => {
      if (cancelled) return
      if (Array.isArray(data)) setVisitadores(data.slice(0,4).map((v: unknown) => {
        const vv = v as { nombre: string; primer_apellido: string }
        return { name: `${vv.nombre} ${vv.primer_apellido || ''}`.trim() }
      }))
    }).catch(() => setVisitadores([])).finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  return (
  <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Gráficos y Estadísticas">
    <div className="graficos-intro">
      <h2 className="graficos-title">Analítica Avanzada de Visitas</h2>
      <p className="graficos-sub">Visualiza el rendimiento de la operación.</p>
    </div>

    <div className="graficos-grid">
      <div className="graficos-card">
        <h3 className="graficos-card-title">Visitadores en BD</h3>
        <div className="graficos-bars">
          {loading ? (
            <p style={{ fontSize: 12, color: '#6b7a99' }}>Cargando...</p>
          ) : visitadores.length === 0 ? (
            <p style={{ fontSize: 12, color: '#6b7a99' }}>Sin visitadores</p>
          ) : (
            visitadores.map(r => (
              <div key={r.name} className="graficos-bar-row">
                <span className="graficos-bar-name">{r.name}</span>
                <div className="graficos-bar-track">
                  <div className="graficos-bar-fill" style={{ width: `6%`, background: '#0e9a9e' }} />
                </div>
                <span className="graficos-bar-pct">—</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="graficos-card">
        <h3 className="graficos-card-title">Productividad Semanal</h3>
        <div style={{ padding: 24, textAlign: 'center', color: '#6b7a99', fontSize: 12 }}>Sin datos de productividad</div>
      </div>

      <div className="graficos-card graficos-card--dashed">
        <div className="graficos-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8a9ab5" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 16l3-3 3 3 3-5" /><circle cx="9" cy="9" r="1.5" /></svg>
          <p>Sin datos en BD</p>
          <span>Solo se muestran datos registrados.</span>
        </div>
      </div>
    </div>
  </AdminLayout>
  )
}
