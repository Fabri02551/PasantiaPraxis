import { useCallback, useEffect, useMemo, useState } from 'react'
import { authService } from '../../auth/services/auth.service'
import { medicoService } from '../../core/services/medico.service'
import { institucionService } from '../../core/services/institucion.service'
import { personaService } from '../../core/services/persona.service'
import { especialidadService } from '../../core/services/especialidad.service'
import { visitaService } from '../../core/services/visita.service'
import { ciudadService, type Ciudad } from '../../core/services/ciudad.service'
import {
  hospitalFromDireccion,
  firstDireccionTexto,
  normalizeUbicaciones,
  primeraConCoords,
} from '../../core/utils/medicoDireccion'
import type { VisitaACompletar } from '../views/CompletarVisita/CompletarVisita'

// Información de un destino (médico o institución) necesaria para mostrar y
// completar visitas: nombres, dirección, ciudad y si es particular.
export type DestinoInfo = {
  id: number
  tipo: 'medico' | 'institucion'
  nombre: string
  subtitulo: string
  direccion: string
  particular: boolean
  ciudadId: number | null
  /** null cuando el destino todavía no fue geocodificado. */
  coords: [number, number] | null
  /** Ids de las ubicaciones del destino, para poder elegir consultorio. */
  ubicacionIds: string[]
  ubicacionElegida: string | null
}

export type VisitaResuelta = {
  id: number
  fecha: string | null // 'yyyy-mm-dd' local
  hora: string // 'HH:MM'
  fecha_visita: string | null // fecha real al registrarla
  estado: string // 'por_visitar' | 'realizada'
  registrada: boolean
  extraordinaria: boolean
  tipo: 'medico' | 'institucion'
  destino: DestinoInfo
}

const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function fmtFechaBien(iso: string): { fecha: string | null; hora: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { fecha: iso.slice(0, 10), hora: '' }
  return { fecha: dateKey(d), hora: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}

// Convierte una visita resuelta a la forma que consume CompletarVisita.
export function visitaToACompletar(v: VisitaResuelta): VisitaACompletar {
  const realizada = v.registrada || v.estado === 'realizada'
  return {
    visitaId: v.id,
    id: String(v.id),
    company: v.destino.nombre,
    detail: v.destino.subtitulo || (v.tipo === 'institucion' ? 'Institución' : 'Médico'),
    addr: v.destino.direccion,
    time: v.hora || '—',
    dateLabel: v.fecha ?? '',
    medico: { nombre: v.destino.nombre, especialidad: v.destino.subtitulo, hospital: v.destino.direccion, phone: '' },
    contact: '',
    phone: '',
    status: realizada ? 'Realizada' : 'Por visitar',
  }
}

// Carga las visitas del visitador logueado con el nombre/destino resuelto.
// Lo usan Calendario, Historial y Home para no repetir la lógica.
export function useMisVisitas() {
  const [visitas, setVisitas] = useState<VisitaResuelta[]>([])
  const [loading, setLoading] = useState(true)
  // Ciudad del visitador logueado. El mapa de la ruta se centra acá, y no en
  // el punto medio de los destinos: con la ruta repartida el punto medio cae
  // fuera de la ciudad y el encuadre se va de la ciudad.
  const [miCiudad, setMiCiudad] = useState<{ id: number; nombre: string } | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const me = await authService.getMe()
      const miPersona = me?.persona_id ?? null

      const [ciudadesRaw, miFila] = await Promise.all([
        ciudadService.list().catch(() => []),
        miPersona ? personaService.getById(miPersona).catch(() => null) : Promise.resolve(null),
      ])
      const nombreDeCiudad = new Map<number, string>()
      if (Array.isArray(ciudadesRaw)) (ciudadesRaw as Ciudad[]).forEach((c) => nombreDeCiudad.set(c.id, c.nombre))
      setMiCiudad(miFila?.ciudad_id ? { id: miFila.ciudad_id, nombre: nombreDeCiudad.get(miFila.ciudad_id) ?? '' } : null)

      const [medicosRaw, institucionesRaw, espesRaw, visitasRaw] = await Promise.all([
        medicoService.list().catch(() => []),
        institucionService.list().catch(() => []),
        especialidadService.list().catch(() => []),
        visitaService.list().catch(() => []),
      ])

      const mías = (Array.isArray(visitasRaw) ? visitasRaw : []).filter((v) => v.id_visitador === miPersona)

      // Solo se resuelven los destinos que las visitas realmente referencian.
      //
      // Antes se traía la cartera completa y se pedía la persona de cada uno:
      // 1888 médicos son 1888 requests, y en la mayoría de los casos ninguno
      // tenía visita. Además, una visita extraordinaria puede apuntar a un
      // médico que no está en la cartera del visitador, y con el filtro
      // anterior ese destino aparecía como "Sin destino".
      const medicoIds = new Set<number>()
      const instIds = new Set<number>()
      for (const v of mías) {
        if (v.id_medico) medicoIds.add(v.id_medico)
        if (v.institucion_id) instIds.add(v.institucion_id)
      }

      const espDe = new Map<number, string>()
      if (Array.isArray(espesRaw)) espesRaw.forEach((es) => espDe.set(es.id, es.nombre))

      const destinoPorMedico = new Map<number, DestinoInfo>()
      const medicos = (Array.isArray(medicosRaw) ? medicosRaw : []).filter((m) => medicoIds.has(m.persona_id))
      await Promise.all(
        medicos.map(async (m) => {
          const p = await personaService.getById(m.persona_id).catch(() => null)
          const nombre = p
            ? [p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ').trim()
            : `Médico ${m.matricula || m.persona_id}`
          const ubicaciones = normalizeUbicaciones(m.direccion)
          const conPin = primeraConCoords(ubicaciones)
          destinoPorMedico.set(m.persona_id, {
            id: m.persona_id,
            tipo: 'medico',
            nombre,
            subtitulo: espDe.get(m.especialidad_id) ?? '',
            direccion: hospitalFromDireccion(m.direccion) || 'Sin institución',
            particular: !!m.es_particular,
            ciudadId: p?.ciudad_id ?? null,
            coords: conPin?.coords ?? null,
            ubicacionIds: ubicaciones.map((u) => u.id),
            ubicacionElegida: conPin?.id ?? null,
          })
        }),
      )

      const destinoPorInst = new Map<number, DestinoInfo>()
      ;(Array.isArray(institucionesRaw) ? institucionesRaw : [])
        .filter((i) => instIds.has(i.id))
        .forEach((i) => {
          const ubicaciones = normalizeUbicaciones(i.direccion)
          const conPin = primeraConCoords(ubicaciones)
          destinoPorInst.set(i.id, {
            id: i.id,
            tipo: 'institucion',
            nombre: i.nombre || `Institución ${i.id}`,
            subtitulo: i.tipo_contrato || 'Institución',
            direccion: firstDireccionTexto(i.direccion) || 'Sin dirección registrada',
            particular: !!i.es_particular,
            ciudadId: i.ciudad_id ?? null,
            coords: conPin?.coords ?? null,
            ubicacionIds: ubicaciones.map((u) => u.id),
            ubicacionElegida: conPin?.id ?? null,
          })
        })

      const resueltas: VisitaResuelta[] = mías.map((v) => {
        const destino = v.id_medico
          ? destinoPorMedico.get(v.id_medico)
          : v.institucion_id
            ? destinoPorInst.get(v.institucion_id)
            : null

        // La fecha que ordena y muestra el calendario es la real si ya se
        // registró, y la tentativa si todavía no. Antes solo se leía la
        // tentativa, así que toda visita ya realizada —y toda extraordinaria,
        // que se crea sin tentativa— aparecía sin fecha y se perdía del
        // calendario.
        const referencia = v.fecha_visita ?? v.fecha_visita_tentativa ?? null
        const { fecha, hora } = referencia ? fmtFechaBien(referencia) : { fecha: null, hora: '' }

        return {
          id: v.id,
          fecha,
          hora,
          fecha_visita: v.fecha_visita ?? null,
          estado: v.estado || (v.registrada ? 'realizada' : 'por_visitar'),
          registrada: !!v.registrada,
          extraordinaria: !!v.extraordinaria,
          tipo: destino?.tipo ?? 'medico',
          destino: destino ?? {
            id: 0,
            tipo: 'medico',
            nombre: 'Sin destino',
            subtitulo: '',
            direccion: '—',
            particular: false,
            ciudadId: null,
            coords: null,
            ubicacionIds: [],
            ubicacionElegida: null,
          },
        }
      })
      resueltas.sort(
        (a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? '') || a.hora.localeCompare(b.hora),
      )
      setVisitas(resueltas)
    } catch (err) {
      console.warn('[useMisVisitas] API no disponible', err)
      setVisitas([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const porVisitar = useMemo(() => visitas.filter((v) => !v.registrada), [visitas])

  return { visitas, porVisitar, loading, cargar, miCiudad }
}
