import type { VisitaBE } from '../services/visita.service'

// Visita ejecutada: registrada o estado realizada. Las programadas no suman.
export const esRealizada = (v: VisitaBE) => v.registrada === true || v.estado === 'realizada'

const diaKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const fechaRealizada = (v: VisitaBE): Date | null => {
  if (!esRealizada(v) || !v.fecha_visita) return null
  const d = new Date(v.fecha_visita)
  return Number.isNaN(d.getTime()) ? null : d
}

export type Bucket = { label: string; count: number }

// Últimas N semanas en bloques de 7 días hasta hoy. Etiqueta = día inicial.
export function realizadasPorSemana(visitas: VisitaBE[], semanas = 4): Bucket[] {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const out: Bucket[] = []
  for (let s = semanas - 1; s >= 0; s--) {
    const fin = new Date(hoy)
    fin.setDate(fin.getDate() - s * 7)
    fin.setHours(23, 59, 59, 999)
    const ini = new Date(fin)
    ini.setDate(ini.getDate() - 6)
    ini.setHours(0, 0, 0, 0)
    const count = visitas.filter((v) => {
      const d = fechaRealizada(v)
      return d != null && d >= ini && d <= fin
    }).length
    out.push({ label: `${ini.getDate()}/${ini.getMonth() + 1}`, count })
  }
  return out
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Últimos N meses calendario con su conteo.
export function realizadasPorMes(visitas: VisitaBE[], meses = 6): Bucket[] {
  const ahora = new Date()
  const out: Bucket[] = []
  for (let m = meses - 1; m >= 0; m--) {
    const ref = new Date(ahora.getFullYear(), ahora.getMonth() - m, 1)
    const ini = new Date(ref.getFullYear(), ref.getMonth(), 1)
    const fin = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999)
    const count = visitas.filter((v) => {
      const d = fechaRealizada(v)
      return d != null && d >= ini && d <= fin
    }).length
    out.push({ label: `${MESES[ref.getMonth()]} ${String(ref.getFullYear()).slice(2)}`, count })
  }
  return out
}

// Realizadas cuya fecha cae hoy (hora local).
export function realizadasHoy(visitas: VisitaBE[]): number {
  const hoy = diaKey(new Date())
  return visitas.filter((v) => {
    const d = fechaRealizada(v)
    return d != null && diaKey(d) === hoy
  }).length
}

// Conteo de realizadas por visitador (persona_id).
export function realizadasPorVisitador(visitas: VisitaBE[]): Map<number, number> {
  const map = new Map<number, number>()
  visitas.forEach((v) => {
    if (!esRealizada(v)) return
    map.set(v.id_visitador, (map.get(v.id_visitador) ?? 0) + 1)
  })
  return map
}

// Conteo de realizadas por médico (persona_id del médico).
export function realizadasPorMedico(visitas: VisitaBE[]): Map<number, number> {
  const map = new Map<number, number>()
  visitas.forEach((v) => {
    if (!esRealizada(v) || v.id_medico == null) return
    map.set(v.id_medico, (map.get(v.id_medico) ?? 0) + 1)
  })
  return map
}

// Cantidad de médicos DISTINTOS que cada visitador ya visitó.
export function medicosDistintosPorVisitador(visitas: VisitaBE[]): Map<number, number> {
  const sets = new Map<number, Set<number>>()
  visitas.forEach((v) => {
    if (!esRealizada(v) || v.id_medico == null) return
    const s = sets.get(v.id_visitador) ?? new Set<number>()
    s.add(v.id_medico)
    sets.set(v.id_visitador, s)
  })
  return new Map([...sets].map(([k, s]) => [k, s.size]))
}

// Serie diaria (últimos N días) de visitas realizadas, agrupada por persona
// (visitador o médico). Devuelve las etiquetas de día, las top-N series y la
// serie "Otros" (suma del resto) para no saturar la gráfica.
export type SerieDiaria = { id: number; counts: number[] }

export function realizadasPorDiaPorPersona(
  visitas: VisitaBE[],
  opt: { clave: 'visitador' | 'medico'; dias?: number; top?: number },
): { labels: string[]; series: SerieDiaria[]; otros: number[] } {
  const dias = opt.dias ?? 7
  const top = opt.top ?? 5
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fechas: Date[] = []
  const labels: string[] = []
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoy)
    d.setDate(d.getDate() - i)
    fechas.push(d)
    labels.push(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const idxPorDia = new Map(fechas.map((d, i) => [diaKey(d), i]))
  const porPersona = new Map<number, number[]>()
  const totales = new Map<number, number>()
  visitas.forEach((v) => {
    if (!esRealizada(v)) return
    const id = opt.clave === 'visitador' ? v.id_visitador : v.id_medico
    if (id == null) return
    const d = fechaRealizada(v)
    if (d == null) return
    const i = idxPorDia.get(diaKey(d))
    if (i == null) return
    const arr = porPersona.get(id) ?? new Array(dias).fill(0)
    arr[i] += 1
    porPersona.set(id, arr)
    totales.set(id, (totales.get(id) ?? 0) + 1)
  })
  const ids = [...porPersona.keys()].sort((a, b) => (totales.get(b) ?? 0) - (totales.get(a) ?? 0))
  const topIds = ids.slice(0, top)
  const restoIds = ids.slice(top)
  const series: SerieDiaria[] = topIds.map((id) => ({ id, counts: porPersona.get(id)! }))
  const otros = new Array(dias).fill(0)
  restoIds.forEach((id) => porPersona.get(id)!.forEach((c, i) => { otros[i] += c }))
  return { labels, series, otros }
}
