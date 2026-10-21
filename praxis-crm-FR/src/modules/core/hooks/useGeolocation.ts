import { useCallback, useState } from 'react'

/**
 * Hook para capturar la posición del visitador con navigator.geolocation.
 *
 * Decisiones que importan:
 *
 * - NO lanza la captura sola. El permiso se pide en un clic, no al montar la
 *   pantalla. Un permiso que aparece sin que la persona haya pedido nada se
 *   rechaza solo, y además llega en el peor momento: apenas abre la app.
 *
 * - La precisión se guarda porque sirve para dudar del dato. Un pin con 200 m
 *   de precisión no prueba que el visitador estuvo ahí; uno con 8 m sí. El
 *   backend lo guarda en visita.gps_precision_m para que la auditoría pueda
 *   distinguir.
 *
 * - Si el permiso se deniega o no hay señal, NO es un error que tape la
 *   pantalla: se devuelve un estado con error y la visita se puede registrar
 *   igual. En terreno sin cobertura, bloquear el registro dejaría al visitador
 *   sin poder trabajar. Lo que se marca es sin_evidencia_ubicacion.
 */
export type GpsEstado = 'inactivo' | 'pidiendo' | 'ok' | 'error'

export type GpsPosicion = {
  latitud: number
  longitud: number
  precisionM: number | null
  /** Momento de la lectura, ISO. Permite saber si el pin está viejo. */
  tomadaEn: string
}

export type GpsResultado =
  | { estado: 'inactivo' }
  | { estado: 'pidiendo' }
  | { estado: 'ok'; posicion: GpsPosicion }
  | { estado: 'error'; mensaje: string }

const MENSAJES: Record<number, string> = {
  1: 'Permiso de ubicación denegado. Podés registrar la visita igual, pero se guardará sin evidencia de ubicación.',
  2: 'No se pudo determinar tu posición. Revisá que el GPS del celular esté activado.',
  3: 'La consulta de ubicación tardó demasiado. Probá de nuevo en un lugar con señal.',
}

// En desktop el timeout se cumple antes de que una señal GPS real aparezca; en
// celular, fijar un límite corto tiraría lecturas válidas. 20 s es el punto en
// el que una persona ya cree que la app se colgó.
const TIMEOUT_MS = 20_000

export function useGeolocation() {
  const [resultado, setResultado] = useState<GpsResultado>({ estado: 'inactivo' })

  /**
   * Pide la posición una vez.
   *
   * getCurrentPosition y no watchPosition: acá interesa el dónde estoy al
   * registrar la visita, no un seguimiento continuo que agotaría la batería
   * en un recorrido de ocho horas.
   */
  const pedir = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setResultado({
        estado: 'error',
        mensaje:
          'Este navegador no permite obtener la ubicación. Registrá la visita sin coordenadas.',
      })
      return
    }

    setResultado({ estado: 'pidiendo' })

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setResultado({
          estado: 'ok',
          posicion: {
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude,
            // El navegador puede no informar precisión; se guarda null en
            // lugar de inventar un número.
            precisionM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
            tomadaEn: new Date(pos.timestamp).toISOString(),
          },
        })
      },
      (err) => {
        setResultado({
          estado: 'error',
          mensaje: MENSAJES[err.code] ?? 'No se pudo obtener la ubicación.',
        })
      },
      {
        enableHighAccuracy: true,
        timeout: TIMEOUT_MS,
        // Con `false`, un GPS que ya tiene un fix guardado no se despierta:
        // responde rápido con un pin viejo. Para auditar una visita, un pin
        // viejo es peor que ningún pin.
        maximumAge: 0,
      },
    )
  }, [])

  const limpiar = useCallback(() => setResultado({ estado: 'inactivo' }), [])

  return { resultado, pedir, limpiar }
}

/** Distancia en metros entre dos puntos, con la fórmula haversine. */
export function distanciaMetros(
  a: { latitud: number; longitud: number },
  b: { latitud: number; longitud: number },
): number {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (b.latitud - a.latitud) * rad
  const dLon = (b.longitud - a.longitud) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitud * rad) * Math.cos(b.latitud * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** "350 m", "1.2 km". Pensado para mostrarse, no para calcularse. */
export function formatearDistancia(metros: number): string {
  if (!Number.isFinite(metros)) return '—'
  if (metros < 1000) return `${Math.round(metros)} m`
  return `${(metros / 1000).toFixed(1)} km`
}
