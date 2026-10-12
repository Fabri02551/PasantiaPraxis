import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '../../components/AdminLayout/AdminLayout'
import type { AdminView } from '../../components/AdminSidebar/AdminSidebar'
import { visitaService, type VisitaBE } from '../../../core/services/visita.service'
import { visitadorService, type VisitadorBE } from '../../../core/services/visitador.service'
import { medicoService, type MedicoBE } from '../../../core/services/medico.service'
import { personaService } from '../../../core/services/persona.service'
import { especialidadService } from '../../../core/services/especialidad.service'
import { getInitials, avatarStyle } from '../../../core/utils/avatar'
import './Reportes.css'

interface Props {
  currentView: AdminView
  onNavigate: (v: AdminView) => void
  onLogout: () => void
}

type FilaRanking = {
  id: number
  nombre: string
  extra: string
  total: number
  realizadas: number
}

// Solo cuentan las visitas ejecutadas: registrada o estado realizada.
// Las programadas (por_visitar) no suman al ranking.
const esRealizada = (v: VisitaBE) => v.registrada === true || v.estado === 'realizada'

const nombreVisitador = (v: VisitadorBE) =>
  [v.nombre, v.primer_apellido, v.segundo_apellido].filter(Boolean).join(' ').trim() || v.correo

export const ReportesView: React.FC<Props> = ({ currentView, onNavigate, onLogout }) => {
  const [visitas, setVisitas] = useState<VisitaBE[]>([])
  const [visitadores, setVisitadores] = useState<VisitadorBE[]>([])
  const [medicos, setMedicos] = useState<MedicoBE[]>([])
  const [nombresMedicos, setNombresMedicos] = useState<Record<number, string>>({})
  const [especialidades, setEspecialidades] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.allSettled([
      visitaService.list(),
      visitadorService.list(),
      medicoService.list(),
      especialidadService.list(),
    ])
      .then(async (res) => {
        if (cancelled) return
        const vs = res[0].status === 'fulfilled' && Array.isArray(res[0].value) ? res[0].value : []
        const vt = res[1].status === 'fulfilled' && Array.isArray(res[1].value) ? res[1].value : []
        const md = res[2].status === 'fulfilled' && Array.isArray(res[2].value) ? res[2].value : []
        const es = res[3].status === 'fulfilled' && Array.isArray(res[3].value) ? res[3].value : []
        if (res[0].status !== 'fulfilled') setError('No se pudieron cargar las visitas')
        setVisitas(vs)
        setVisitadores(vt)
        setMedicos(md)
        const esp: Record<number, string> = {}
        es.forEach((e: { id: number; nombre: string }) => { esp[e.id] = e.nombre })
        setEspecialidades(esp)
        // Nombres de médicos con visita registrada (pocos, se resuelven uno por uno).
        const ids = [...new Set(vs.map((v) => v.id_medico).filter((x): x is number => x != null))]
        const nombres: Record<number, string> = {}
        await Promise.all(ids.map(async (id) => {
          try {
            const p = await personaService.getById(id)
            nombres[id] = [p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ').trim() || `Médico ${id}`
          } catch {
            nombres[id] = `Médico ${id}`
          }
        }))
        if (!cancelled) setNombresMedicos(nombres)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const rankingVisitadores = useMemo<FilaRanking[]>(() => {
    const porId = new Map<number, { total: number; realizadas: number }>()
    visitas.forEach((v) => {
      const e = porId.get(v.id_visitador) ?? { total: 0, realizadas: 0 }
      e.total += 1
      if (esRealizada(v)) e.realizadas += 1
      porId.set(v.id_visitador, e)
    })
    return visitadores
      .map((t) => ({
        id: t.persona_id,
        nombre: nombreVisitador(t),
        extra: t.correo,
        total: porId.get(t.persona_id)?.total ?? 0,
        realizadas: porId.get(t.persona_id)?.realizadas ?? 0,
      }))
      .sort((a, b) => b.realizadas - a.realizadas || b.total - a.total)
  }, [visitas, visitadores])

  const rankingMedicos = useMemo<FilaRanking[]>(() => {
    const porId = new Map<number, { total: number; realizadas: number }>()
    visitas.forEach((v) => {
      if (v.id_medico == null) return
      const e = porId.get(v.id_medico) ?? { total: 0, realizadas: 0 }
      e.total += 1
      if (esRealizada(v)) e.realizadas += 1
      porId.set(v.id_medico, e)
    })
    const medicoDe = new Map(medicos.map((m) => [m.persona_id, m]))
    return [...porId.entries()]
      .map(([id, c]) => ({
        id,
        nombre: nombresMedicos[id] ?? `Médico ${id}`,
        extra: especialidades[medicoDe.get(id)?.especialidad_id ?? -1] ?? '—',
        total: c.total,
        realizadas: c.realizadas,
      }))
      .sort((a, b) => b.realizadas - a.realizadas || b.total - a.total)
  }, [visitas, medicos, nombresMedicos, especialidades])

  const mejorVisitador = rankingVisitadores.find((r) => r.realizadas > 0) ?? null
  const mejorMedico = rankingMedicos.find((r) => r.realizadas > 0) ?? null
  const totalRealizadas = useMemo(() => visitas.filter(esRealizada).length, [visitas])
  const fecha = useMemo(
    () => new Date().toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' }),
    [],
  )

  const imprimir = () => {
    document.body.classList.add('printing-report')
    const fin = () => {
      document.body.classList.remove('printing-report')
      window.removeEventListener('afterprint', fin)
    }
    window.addEventListener('afterprint', fin)
    // La clase entra antes de abrir el diálogo para que el CSS aplique.
    setTimeout(() => window.print(), 60)
  }

  return (
    <AdminLayout currentView={currentView} onNavigate={onNavigate} onLogout={onLogout} title="Reportes">
      <div className="report-actions no-print">
        <p className="report-hint">
          {loading ? 'Cargando datos…' : `${visitas.length} visitas en total, ${totalRealizadas} realizadas.`}
        </p>
        <button className="btn-print" onClick={imprimir} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 9V2h12v7" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Imprimir / PDF
        </button>
      </div>
      {error && <p className="report-error no-print">{error}</p>}

      <div className="report-sheet">
        <div className="report-letterhead">
          <img src="/praxis-logo.png" alt="Praxis — Laboratorio Clínico" className="report-logo" />
          <div className="report-letterhead-text">
            <h2 className="report-doc-title">Reporte de visitas</h2>
            <p className="report-doc-sub">Laboratorio Clínico Praxis · {fecha}</p>
          </div>
        </div>

        {loading ? (
          <p className="report-status">Cargando datos…</p>
        ) : visitas.length === 0 ? (
          <p className="report-status">Sin visitas registradas. El reporte se llena solo cuando haya visitas.</p>
        ) : (
          <>
            <div className="report-best-row">
              <div className="report-best-card">
                <span className="report-best-tag">Mejor visitador</span>
                {mejorVisitador ? (
                  <>
                    <span
                      className="report-best-avatar"
                      style={avatarStyle(mejorVisitador.nombre)}
                      aria-hidden
                    >
                      {getInitials(mejorVisitador.nombre)}
                    </span>
                    <strong className="report-best-name">{mejorVisitador.nombre}</strong>
                    <span className="report-best-count">{mejorVisitador.realizadas} visitas realizadas</span>
                  </>
                ) : (
                  <span className="report-status">Sin visitas realizadas aún.</span>
                )}
              </div>
              <div className="report-best-card">
                <span className="report-best-tag">Médico más visitado</span>
                {mejorMedico ? (
                  <>
                    <span
                      className="report-best-avatar"
                      style={avatarStyle(mejorMedico.nombre)}
                      aria-hidden
                    >
                      {getInitials(mejorMedico.nombre)}
                    </span>
                    <strong className="report-best-name">{mejorMedico.nombre}</strong>
                    <span className="report-best-count">
                      {mejorMedico.realizadas} visitas · {mejorMedico.extra}
                    </span>
                  </>
                ) : (
                  <span className="report-status">Sin visitas realizadas aún.</span>
                )}
              </div>
            </div>

            <div className="report-tables">
              <section className="report-table-card">
                <h3 className="report-table-title">Ranking de visitadores</h3>
                <table className="report-table">
                  <thead>
                    <tr><th>#</th><th>Visitador</th><th>Realizadas</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    {rankingVisitadores.map((r, i) => (
                      <tr key={r.id} className={i === 0 && r.realizadas > 0 ? 'report-row-best' : ''}>
                        <td>{i + 1}</td>
                        <td>{r.nombre}</td>
                        <td>{r.realizadas}</td>
                        <td>{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section className="report-table-card">
                <h3 className="report-table-title">Médicos más visitados</h3>
                {rankingMedicos.length === 0 ? (
                  <p className="report-status">Ninguna visita apunta a un médico.</p>
                ) : (
                  <table className="report-table">
                    <thead>
                      <tr><th>#</th><th>Médico</th><th>Realizadas</th><th>Total</th></tr>
                    </thead>
                    <tbody>
                      {rankingMedicos.map((r, i) => (
                        <tr key={r.id} className={i === 0 && r.realizadas > 0 ? 'report-row-best' : ''}>
                          <td>{i + 1}</td>
                          <td>{r.nombre}</td>
                          <td>{r.realizadas}</td>
                          <td>{r.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}

export default ReportesView
