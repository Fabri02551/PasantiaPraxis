import { useCallback, useEffect, useMemo, useState } from 'react'
import { storage } from '../../core/lib/storage'
import { useMisVisitas, type VisitaResuelta } from './useMisVisitas'

export type NotifVariant = 'info' | 'clock' | 'alert'

export type Notificacion = {
  /** Estable entre recargas: es lo que se marca como visto. */
  id: string
  title: string
  desc: string
  /** Etiqueta de la esquina derecha: hora, "hace 2 h", "hoy", etc. */
  time: string
  variant: NotifVariant
  /** Visita relacionada, para poder navegar a completarla. */
  visitaId?: number
  /** Orden interno: menor va primero. */
  peso: number
}

const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * Momento en ms de la visita.
 *
 * Una visita sin hora se trata como el final de su día: si se tomara como
 * medianoche, cualquier visita de hoy sin hora sería "pasada" desde las 00:00
 * y el visitador abriría la bandeja con alertas falsas.
 */
function instante(v: VisitaResuelta): number | null {
  if (!v.fecha) return null
  const [a, m, d] = v.fecha.split('-').map(Number)
  if (![a, m, d].every(Number.isFinite)) return null
  const [hh, mm] = v.hora ? v.hora.split(':').map(Number) : [23, 59]
  return new Date(a, m - 1, d, hh || 0, mm || 0).getTime()
}

/** "10:30", "ayer 16:00" o "03/10 09:00" según qué tan lejos esté. */
function etiquetaTiempo(ts: number, ahora: Date): string {
  const d = new Date(ts)
  const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const hoy = dateKey(d) === dateKey(ahora)
  if (hoy) return hora

  const ayer = new Date(ahora)
  ayer.setDate(ayer.getDate() - 1)
  if (dateKey(d) === dateKey(ayer)) return `ayer ${hora}`

  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hora}`
}

/** "hace 20 min" / "hace 3 h" / "hace 2 d", para lo que ya venció. */
function cuantoDesde(ts: number, ahora: number): string {
  const min = Math.max(0, Math.round((ahora - ts) / 60000))
  if (min < 1) return 'hace instantes'
  if (min < 60) return `hace ${min} min`
  const horas = Math.round(min / 60)
  if (horas < 24) return `hace ${horas} h`
  return `hace ${Math.round(horas / 24)} d`
}

/** "en 45 min" / "en 3 h", para lo que todavía no llega. */
function cuantoHasta(ts: number, ahora: number): string {
  const min = Math.max(0, Math.round((ts - ahora) / 60000))
  if (min < 1) return 'ahora'
  if (min < 60) return `en ${min} min`
  const horas = Math.round(min / 60)
  if (horas < 24) return `en ${horas} h`
  return `en ${Math.round(horas / 24)} d`
}

/** Instante más cercano de una lista, para fechar avisos groups. */
function masPronto(visitas: VisitaResuelta[]): number | null {
  const ts = visitas.map(instante).filter((x): x is number => x !== null)
  return ts.length > 0 ? Math.min(...ts) : null
}

function diaRelativo(fecha: string | null, ahora: Date): string {
  if (!fecha) return 'sin fecha'
  const manana = new Date(ahora)
  manana.setDate(manana.getDate() + 1)
  if (fecha === dateKey(ahora)) return 'hoy'
  if (fecha === dateKey(manana)) return 'mañana'
  return fecha.split('-').reverse().slice(0, 2).join('/')
}

/**
 * Bandeja de notificaciones del visitador.
 *
 * No hay tabla de notificaciones: todo se deriva de las visitas del visitador
 * (`useMisVisitas`) comparadas contra la hora actual, así que una visita que
 * se pasó a las 10:15 avisa a las 10:16 sin que nadie escriba nada.
 *
 * Prioridades: primero lo que ya se perdió (rojo), después lo que viene
 * (ámbar) y al final el resumen del día.
 */
export function useNotificaciones() {
  const { visitas, porVisitar, loading, cargar } = useMisVisitas()
  const [vistas, setVistas] = useState<string[]>(() => storage.getNotificacionesVistas())
  const [ahora, setAhora] = useState(() => Date.now())

  // El reloj solo importa para decidir qué está vencido. Minuto a minuto
  // alcanza y evita recargar la lista de visitas.
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  const lista = useMemo(() => {
    const ahoraDate = new Date(ahora)
    const out: Notificacion[] = []

    const pendientes = porVisitar
      .map((v) => ({ v, ts: instante(v) }))
      .filter((x): x is { v: VisitaResuelta; ts: number } => x.ts !== null)
      .sort((a, b) => a.ts - b.ts)

    const vencidas = pendientes.filter((x) => x.ts < ahora)
    const futuras = pendientes.filter((x) => x.ts >= ahora)

    // Lo que se pasó: la visita existe y la hora ya pasó sin registrarse.
    for (const { v, ts } of vencidas) {
      out.push({
        id: `pasada:${v.id}`,
        title: 'Visita vencida',
        desc: `Se te pasó la visita a ${v.destino.nombre}${
          v.destino.subtitulo ? ` (${v.destino.subtitulo})` : ''
        }, programada ${diaRelativo(v.fecha, ahoraDate)} a las ${v.hora}.`,
        time: cuantoDesde(ts, ahora),
        variant: 'alert',
        visitaId: v.id,
        peso: ts,
      })
    }

    // La siguiente de la ruta: lo primero que va a hacer el visitador.
    const pro = futuras[0]
    if (pro) {
      out.push({
        id: `proxima:${pro.v.id}`,
        title: 'Próxima visita',
        desc: `${pro.v.destino.nombre}${
          pro.v.destino.subtitulo ? ` (${pro.v.destino.subtitulo})` : ''
        }, ${diaRelativo(pro.v.fecha, ahoraDate)} a las ${pro.v.hora}.`,
        time: cuantoHasta(pro.ts, ahora),
        variant: 'clock',
        visitaId: pro.v.id,
        peso: pro.ts,
      })
    }

    // Visitas huérfanas: apuntan a un médico/institución que ya no resuelve,
    // así que no se pueden completar. Sin esto el visitador descubre el
    // problema cuando ya está en la visita.
    const sinDestino = porVisitar.filter((v) => v.destino.id === 0)
    if (sinDestino.length > 0) {
      out.push({
        id: 'sin-destino',
        title: 'Visitas sin destino',
        desc:
          sinDestino.length === 1
            ? `La visita del ${sinDestino[0].fecha ?? 'sin fecha'} no tiene médico ni institución asignada y no se puede completar.`
            : `${sinDestino.length} visitas no tienen médico ni institución asignada y no se pueden completar.`,
        time: masPronto(sinDestino) !== null ? etiquetaTiempo(masPronto(sinDestino)!, ahoraDate) : 'revisar',
        variant: 'alert',
        peso: ahora + 1000,
      })
    }

    // Sin pin el mapa no las puede encuadrar: la visita queda solo con texto.
    const sinPin = porVisitar.filter((v) => v.destino.id !== 0 && v.destino.coords === null)
    if (sinPin.length > 0) {
      out.push({
        id: 'sin-ubicacion',
        title: 'Visitas sin ubicación',
        desc:
          sinPin.length === 1
            ? `${sinPin[0].destino.nombre} no tiene dirección geocodificada, así que no aparece en el mapa de la ruta.`
            : `${sinPin.length} visitas no tienen dirección geocodificada, así que no aparecen en el mapa de la ruta.`,
        time: masPronto(sinPin) !== null ? etiquetaTiempo(masPronto(sinPin)!, ahoraDate) : 'revisar',
        variant: 'info',
        peso: ahora + 2000,
      })
    }

    // Resumen del día.
    const hoy = dateKey(ahoraDate)
    const hoyPendientes = porVisitar.filter((v) => v.fecha === hoy)
    const realizadasHoy = visitas.filter((v) => v.registrada && v.fecha === hoy)
    if (hoyPendientes.length > 0) {
      out.push({
        id: `hoy:${hoy}`,
        title: 'Pendientes de hoy',
        desc: `Te quedan ${hoyPendientes.length} ${
          hoyPendientes.length === 1 ? 'visita' : 'visitas'
        } para hoy${
          vencidas.length > 0 ? `, ${vencidas.length} ya ${vencidas.length === 1 ? 'venció' : 'vencieron'}` : ''
        }.`,
        time: 'hoy',
        variant: vencidas.length > 0 ? 'alert' : 'info',
        peso: ahora + 3000,
      })
    } else if (porVisitar.length > 0) {
      const primera = porVisitar.reduce((a, b) => ((instante(a) ?? Infinity) <= (instante(b) ?? Infinity) ? a : b))
      out.push({
        id: 'sin-visitas-hoy',
        title: 'Sin visitas hoy',
        desc: `No tenés visitas programadas para hoy. Tu próxima pendiente es ${primera.destino.nombre}, ${
          diaRelativo(primera.fecha, ahoraDate)
        }.`,
        time: 'hoy',
        variant: 'info',
        peso: ahora + 3000,
      })
    } else {
      out.push({
        id: 'ruta-al-dia',
        title: 'Ruta al día',
        desc:
          realizadasHoy.length > 0
            ? `Completaste ${realizadasHoy.length} ${
                realizadasHoy.length === 1 ? 'visita' : 'visitas'
              } hoy y no te queda ninguna pendiente.`
            : 'No te quedan visitas pendientes.',
        time: 'hoy',
        variant: 'info',
        peso: ahora + 3000,
      })
    }

    return out.sort((a, b) => a.peso - b.peso)
  }, [porVisitar, visitas, ahora])

  const noVistas = useMemo(() => lista.filter((n) => !vistas.includes(n.id)), [lista, vistas])

  const marcarTodasVistas = useCallback(() => {
    setVistas((prev) => {
      const todas = Array.from(new Set([...prev, ...lista.map((n) => n.id)]))
      storage.setNotificacionesVistas(todas)
      return todas
    })
  }, [lista])

  const alertas = useMemo(() => lista.filter((n) => n.variant === 'alert').length, [lista])

  return {
    notificaciones: lista,
    loading,
    /** Las que todavía no se abrieron: es el número del punto rojo. */
    nuevas: noVistas.length,
    alertas,
    marcarTodasVistas,
    recargar: cargar,
  }
}
/**
 * Cuántas visitas pendientes ya vencieron. Es lo que enciende el punto rojo
 * del encabezado, y se exporta suelto para que las vistas que ya tienen la
 * lista de visitas no carguen la cartera otra vez solo por esto.
 */
export function cuentaVencidas(visitas: VisitaResuelta[], ahora = Date.now()): number {
  return visitas.filter((v) => {
    if (v.registrada) return false
    const ts = instante(v)
    return ts !== null && ts < ahora
  }).length
}
