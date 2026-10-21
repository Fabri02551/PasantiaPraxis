import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { visitadorService, type VisitadorBE } from '../../../core/services/visitador.service'
import { visitaService, type VisitaBE } from '../../../core/services/visita.service'
import { medicoService, type MedicoBE } from '../../../core/services/medico.service'
import { personaService, type Persona } from '../../../core/services/persona.service'
import { especialidadService, type Especialidad } from '../../../core/services/especialidad.service'
import {
  esRealizada,
  realizadasPorVisitador,
  realizadasPorMedico,
  medicosDistintosPorVisitador,
  realizadasPorDiaPorPersona,
  type SerieDiaria,
} from '../../../core/utils/visitaStats'
import './Graficos.css'

interface Props {
  currentView: AdminView
  onNavigate: (v: AdminView) => void
  onLogout: () => void
}

const COLORES = ['#0e9a9e', '#f59e0b', '#7c3aed', '#1B2A4E', '#e11d48', '#7ed3b2']

const nombreVisitador = (v: VisitadorBE) =>
  [v.nombre, v.primer_apellido, v.segundo_apellido].filter(Boolean).join(' ').trim() || v.correo

const nombrePersona = (p: Persona) =>
  [p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ').trim() || `#${p.id}`

type Fila = { name: string; val: number }

const Barras: React.FC<{ filas: Fila[]; max: number; color: string }> = ({ filas, max, color }) => (
  <div className="graficos-bars">
    {filas.length === 0 ? (
      <p className="graficos-empty-text">Sin datos</p>
    ) : (
      filas.map((r) => (
        <div key={r.name} className="graficos-bar-row">
          <span className="graficos-bar-name" title={r.name}>{r.name}</span>
          <div className="graficos-bar-track">
            <div
              className="graficos-bar-fill"
              style={{ width: `${r.val > 0 ? Math.max(8, (r.val / max) * 100) : 4}%`, background: color }}
            />
          </div>
          <span className="graficos-bar-pct">{r.val}</span>
        </div>
      ))
    )}
  </div>
)

// Gráfica de líneas multi-serie (SVG a mano, patrón del proyecto).
const LineasDiarias: React.FC<{
  labels: string[]
  series: { name: string; counts: number[] }[]
  loading: boolean
}> = ({ labels, series, loading }) => {
  if (loading) return <p className="graficos-empty-text">Cargando...</p>
  const n = labels.length
  const max = Math.max(1, ...series.flatMap((s) => s.counts))
  const x = (i: number) => 36 + (i * (320 - 36)) / Math.max(1, n - 1)
  const y = (c: number) => 105 - (c / max) * 85
  const activas = series.filter((s) => s.counts.some((c) => c > 0))
  if (activas.length === 0) return <p className="graficos-empty-text">Sin visitas realizadas en el período</p>
  return (
    <div className="graficos-line-wrap">
      <svg viewBox="0 0 330 120" className="graficos-line-svg" preserveAspectRatio="none">
        <line x1="30" y1="10" x2="30" y2="105" stroke="#e8ecf1" strokeWidth="1" />
        <line x1="30" y1="105" x2="325" y2="105" stroke="#e8ecf1" strokeWidth="1" />
        <line x1="30" y1="57" x2="325" y2="57" stroke="#f4f6f9" strokeWidth="1" />
        {activas.map((s, si) => {
          const color = COLORES[si % COLORES.length]
          const pts = s.counts.map((c, i) => `${Math.round(x(i))},${Math.round(y(c))}`).join(' ')
          return (
            <g key={s.name}>
              <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={pts}
              />
              {s.counts.map((c, i) => (
                <circle key={i} cx={Math.round(x(i))} cy={Math.round(y(c))} r="3" fill={color} stroke="#fff" strokeWidth="1.5">
                  <title>{s.name} · {labels[i]}: {c}</title>
                </circle>
              ))}
            </g>
          )
        })}
      </svg>
      <div className="graficos-line-labels" style={{ gridTemplateColumns: `repeat(${n},1fr)` }}>
        {labels.map((l) => <span key={l}>{l}</span>)}
      </div>
      <div className="graficos-legend">
        {activas.map((s, si) => (
          <span key={s.name} className="graficos-legend-item">
            <i style={{ background: COLORES[si % COLORES.length] }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}

export const GraficosView: React.FC<Props> = ({ currentView, onNavigate, onLogout }) => {
  const [visitadores, setVisitadores] = useState<VisitadorBE[]>([])
  const [visitas, setVisitas] = useState<VisitaBE[]>([])
  const [medicos, setMedicos] = useState<MedicoBE[]>([])
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      visitadorService.list(),
      visitaService.list(),
      medicoService.list(),
      especialidadService.list(),
      personaService.list(),
    ]).then(([rt, rv, rm, re, rp]) => {
      if (cancelled) return
      if (rt.status === 'fulfilled' && Array.isArray(rt.value)) setVisitadores(rt.value)
      if (rv.status === 'fulfilled' && Array.isArray(rv.value)) setVisitas(rv.value)
      if (rm.status === 'fulfilled' && Array.isArray(rm.value)) setMedicos(rm.value)
      if (re.status === 'fulfilled' && Array.isArray(re.value)) setEspecialidades(re.value)
      if (rp.status === 'fulfilled' && Array.isArray(rp.value)) setPersonas(rp.value)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const nombres = useMemo(() => {
    const map = new Map<number, string>()
    personas.forEach((p) => map.set(p.id, nombrePersona(p)))
    visitadores.forEach((v) => map.set(v.persona_id, nombreVisitador(v)))
    return map
  }, [personas, visitadores])

  // 1) Visita / Médico — visitas realizadas por cada médico.
  const filasMedicos = useMemo(() => {
    const porMedico = realizadasPorMedico(visitas)
    return [...porMedico.entries()]
      .map(([id, val]) => ({ name: nombres.get(id) ?? `Médico ${id}`, val }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 8)
  }, [visitas, nombres])
  const maxMedicos = Math.max(1, ...filasMedicos.map((f) => f.val))

  // 2) Visita / Visitador — visitas realizadas por cada visitador.
  const filasVisitadores = useMemo(() => {
    const porVisitador = realizadasPorVisitador(visitas)
    return visitadores
      .map((v) => ({ name: nombreVisitador(v), val: porVisitador.get(v.persona_id) ?? 0 }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 8)
  }, [visitas, visitadores])
  const maxVisitadores = Math.max(1, ...filasVisitadores.map((f) => f.val))

  // 3) Médico / Visita — médicos distintos ya visitados (por visitador).
  const filasMedicosDistintos = useMemo(() => {
    const porVisitador = medicosDistintosPorVisitador(visitas)
    return visitadores
      .map((v) => ({ name: nombreVisitador(v), val: porVisitador.get(v.persona_id) ?? 0 }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 8)
  }, [visitas, visitadores])
  const totalMedicosDistintos = useMemo(() => {
    const s = new Set<number>()
    visitas.forEach((v) => { if (esRealizada(v) && v.id_medico != null) s.add(v.id_medico) })
    return s.size
  }, [visitas])
  const maxMedicosDistintos = Math.max(1, ...filasMedicosDistintos.map((f) => f.val))

  // 4) Día / Visitador — líneas: últimos 7 días, top 5 visitadores + Otros.
  const diariaVisitador = useMemo(() => {
    const { labels, series, otros } = realizadasPorDiaPorPersona(visitas, { clave: 'visitador', dias: 7, top: 5 })
    const out = series.map((s: SerieDiaria) => ({ name: nombres.get(s.id) ?? `Visitador ${s.id}`, counts: s.counts }))
    if (otros.some((c) => c > 0)) out.push({ name: 'Otros', counts: otros })
    return { labels, series: out }
  }, [visitas, nombres])

  // 5) Día / Médico — líneas: últimos 7 días, top 5 médicos + Otros.
  const diariaMedico = useMemo(() => {
    const { labels, series, otros } = realizadasPorDiaPorPersona(visitas, { clave: 'medico', dias: 7, top: 5 })
    const out = series.map((s: SerieDiaria) => ({ name: nombres.get(s.id) ?? `Médico ${s.id}`, counts: s.counts }))
    if (otros.some((c) => c > 0)) out.push({ name: 'Otros', counts: otros })
    return { labels, series: out }
  }, [visitas, nombres])

  // 6) Especialidad / Total médicos — cuántos médicos hay en cada especialidad.
  const filasEspecialidades = useMemo(() => {
    const nombresEsp = new Map(especialidades.map((e) => [e.id, e.nombre]))
    const conteo = new Map<number, number>()
    medicos.forEach((m) => {
      conteo.set(m.especialidad_id, (conteo.get(m.especialidad_id) ?? 0) + 1)
    })
    return [...conteo.entries()]
      .map(([id, val]) => ({ name: nombresEsp.get(id) ?? `Especialidad ${id}`, val }))
      .sort((a, b) => b.val - a.val)
  }, [medicos, especialidades])
  const maxEspecialidades = Math.max(1, ...filasEspecialidades.map((f) => f.val))

  const realizadas = useMemo(() => visitas.filter(esRealizada).length, [visitas])
  const programadas = visitas.length - realizadas
  const extraordinarias = useMemo(() => visitas.filter((v) => v.extraordinaria === true).length, [visitas])

  return (
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Gráficos y Estadísticas">
      <div className="graficos-intro">
        <h2 className="graficos-title">Analítica Avanzada de Visitas</h2>
        <p className="graficos-sub">Visitas por médico y visitador, cobertura diaria y distribución por especialidad.</p>
      </div>

      <div className="graficos-grid">
        <div className="graficos-card">
          <h3 className="graficos-card-title">Visitas / Médico</h3>
          <p className="graficos-card-sub">Visitas realizadas recibidas por cada médico</p>
          {loading
            ? <p className="graficos-empty-text">Cargando...</p>
            : <Barras filas={filasMedicos} max={maxMedicos} color="#0e9a9e" />}
        </div>

        <div className="graficos-card">
          <h3 className="graficos-card-title">Visitas / Visitador</h3>
          <p className="graficos-card-sub">Visitas realizadas registradas por cada visitador</p>
          {loading
            ? <p className="graficos-empty-text">Cargando...</p>
            : <Barras filas={filasVisitadores} max={maxVisitadores} color="#0e7490" />}
        </div>

        <div className="graficos-card">
          <h3 className="graficos-card-title">Médicos / Visita</h3>
          <p className="graficos-card-sub">
            Médicos distintos ya visitados
            {!loading && <span className="graficos-kpi-inline">{totalMedicosDistintos} en total</span>}
          </p>
          {loading
            ? <p className="graficos-empty-text">Cargando...</p>
            : <Barras filas={filasMedicosDistintos} max={maxMedicosDistintos} color="#7c3aed" />}
        </div>

        <div className="graficos-card">
          <h3 className="graficos-card-title">Día / Visitador</h3>
          <p className="graficos-card-sub">Visitas diarias (7 días) de los 5 visitadores más activos</p>
          <LineasDiarias labels={diariaVisitador.labels} series={diariaVisitador.series} loading={loading} />
        </div>

        <div className="graficos-card">
          <h3 className="graficos-card-title">Día / Médico</h3>
          <p className="graficos-card-sub">Visitas diarias (7 días) de los 5 médicos más visitados</p>
          <LineasDiarias labels={diariaMedico.labels} series={diariaMedico.series} loading={loading} />
        </div>

        <div className="graficos-card">
          <h3 className="graficos-card-title">Especialidad / Total médicos</h3>
          <p className="graficos-card-sub">Distribución de médicos por especialidad</p>
          {loading
            ? <p className="graficos-empty-text">Cargando...</p>
            : <Barras filas={filasEspecialidades} max={maxEspecialidades} color="#f59e0b" />}
        </div>

        <div className="graficos-card graficos-card--wide">
          <h3 className="graficos-card-title">Totales</h3>
          <div className="graficos-totales">
            {[
              { label: 'Visitas realizadas', val: realizadas, color: '#0e9a9e' },
              { label: 'Programadas pendientes', val: programadas, color: '#f59e0b' },
              { label: 'Extraordinarias', val: extraordinarias, color: '#7c3aed' },
            ].map((t) => (
              <div key={t.label} className="graficos-total-row">
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: '#1b2a4e' }}>{t.label}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#1b2a4e' }}>{loading ? '—' : t.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default GraficosView
