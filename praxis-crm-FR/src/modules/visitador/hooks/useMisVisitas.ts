import { useCallback, useEffect, useMemo, useState } from 'react'
import { authService } from '../../auth/services/auth.service'
import { medicoService } from '../../core/services/medico.service'
import { institucionService } from '../../core/services/institucion.service'
import { personaService } from '../../core/services/persona.service'
import { especialidadService } from '../../core/services/especialidad.service'
import { visitaService } from '../../core/services/visita.service'
import { hospitalFromDireccion, firstDireccionTexto, DEFAULT_COORDS } from '../../core/utils/medicoDireccion'
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
  coords: [number, number]
}

export type VisitaResuelta = {
  id: number
  fecha: string | null // 'yyyy-mm-dd' local (fecha_visita_tentativa)
  hora: string // 'HH:MM'
  fecha_visita: string | null // fecha real al registrarla
  estado: string // 'por_visitar' | 'realizada'
  registrada: boolean
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

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const me = await authService.getMe()
      const miPersona = me?.persona_id ?? null

      const [medicosRaw, institucionesRaw, espesRaw, visitasRaw] = await Promise.all([
        medicoService.list().catch(() => []),
        institucionService.list().catch(() => []),
        especialidadService.list().catch(() => []),
        visitaService.list().catch(() => []),
      ])

      const espDe = new Map<number, string>()
      if (Array.isArray(espesRaw)) espesRaw.forEach((es) => espDe.set(es.id, es.nombre))

      const destinoPorMedico = new Map<number, DestinoInfo>()
      const medicosMios = Array.isArray(medicosRaw) ? medicosRaw.filter((m) => m.visitador_id === miPersona) : []
      await Promise.all(medicosMios.map(async (m) => {
        const p = await personaService.getById(m.persona_id).catch(() => null)
        const nombre = p
          ? [p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ').trim()
          : `Médico ${m.matricula || m.persona_id}`
        destinoPorMedico.set(m.persona_id, {
          id: m.persona_id,
          tipo: 'medico',
          nombre,
          subtitulo: espDe.get(m.especialidad_id) ?? '',
          direccion: hospitalFromDireccion(m.direccion) || 'Sin institución',
          particular: !!m.es_particular,
          ciudadId: p?.ciudad_id ?? null,
          coords: DEFAULT_COORDS,
        })
      }))

      const destinoPorInst = new Map<number, DestinoInfo>()
      ;(Array.isArray(institucionesRaw) ? institucionesRaw : []).forEach((i) => {
        destinoPorInst.set(i.id, {
          id: i.id,
          tipo: 'institucion',
          nombre: i.nombre || `Institución ${i.id}`,
          subtitulo: i.tipo_contrato || 'Institución',
          direccion: firstDireccionTexto(i.direccion) || 'Sin dirección registrada',
          particular: !!i.es_particular,
          ciudadId: i.ciudad_id ?? null,
          coords: DEFAULT_COORDS,
        })
      })

      const mías = (Array.isArray(visitasRaw) ? visitasRaw : []).filter((v) => v.id_visitador === miPersona)
      const resueltas: VisitaResuelta[] = mías.map((v) => {
        const destino = v.id_medico
          ? destinoPorMedico.get(v.id_medico)
          : v.institucion_id
            ? destinoPorInst.get(v.institucion_id)
            : null
        const { fecha, hora } = v.fecha_visita_tentativa ? fmtFechaBien(v.fecha_visita_tentativa) : { fecha: null, hora: '' }
        return {
          id: v.id,
          fecha,
          hora,
          fecha_visita: v.fecha_visita ?? null,
          estado: v.estado || (v.registrada ? 'realizada' : 'por_visitar'),
          registrada: !!v.registrada,
          tipo: destino?.tipo ?? 'medico',
          destino: destino ?? {
            id: 0,
            tipo: 'medico',
            nombre: 'Sin destino',
            subtitulo: '',
            direccion: '—',
            particular: false,
            ciudadId: null,
            coords: DEFAULT_COORDS,
          },
        }
      })
      resueltas.sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? '') || a.hora.localeCompare(b.hora))
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

  return { visitas, porVisitar, loading, cargar }
}