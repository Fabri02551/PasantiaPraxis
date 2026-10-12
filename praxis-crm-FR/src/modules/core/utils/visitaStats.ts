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
