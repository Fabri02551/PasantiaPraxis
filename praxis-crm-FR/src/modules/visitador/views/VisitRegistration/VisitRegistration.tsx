import { useRef, useState, useEffect } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import { medicoService } from '../../../core/services/medico.service'
import { normalizeUbicaciones, hospitalFromDireccion } from '../../../core/utils/medicoDireccion'
import './VisitRegistration.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

type MedicoExtra = {
  id: string
  nombre: string
  especialidad: string
  hospital: string
  visitadorAsignado: string | null
  ubicaciones: { id: string; direccion: string; detalle: string }[]
}

const MEDICOS_EXTRA: MedicoExtra[] = []

export const VisitRegistrationView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchMedico, setSearchMedico] = useState('')
  const [selectedMedicoId, setSelectedMedicoId] = useState<string>('')
  const [selectedUbicacionId, setSelectedUbicacionId] = useState<string>('')
  const [observaciones, setObservaciones] = useState('')
  const [exigencias, setExigencias] = useState('')
  const [medicos, setMedicos] = useState<MedicoExtra[]>(MEDICOS_EXTRA)

  // Setup canvas for HiDPI
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = '#1B2A4E'
    ctx.lineWidth = 1.8
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  useEffect(() => {
    let cancelled = false
    medicoService
      .list()
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data) && data.length > 0) {
          const mapped: MedicoExtra[] = data.map((b) => ({
            id: String(b.persona_id),
            nombre: `Médico ${b.matricula || b.persona_id}`,
            especialidad: String(b.especialidad_id ?? 'General'),
            hospital: hospitalFromDireccion(b.direccion) || 'Sin institución',
            visitadorAsignado: null,
            ubicaciones: (() => {
              const ubicaciones = normalizeUbicaciones(b.direccion)
              if (ubicaciones.length > 0) {
                return ubicaciones.map(u => ({ id: u.id, direccion: u.direccion, detalle: u.detalle }))
              }
              return [{ id: 'u1', direccion: hospitalFromDireccion(b.direccion) || 'Sin dirección', detalle: '' }]
            })(),
          }))
          if (!cancelled) setMedicos(mapped)
        } else {
          if (!cancelled) setMedicos([])
        }
      })
      .catch(() => {
        if (!cancelled) setMedicos([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    ctx?.closePath()
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    setHasSignature(false)
  }

  const filteredMedicos = (() => {
    const q = searchMedico.trim().toLowerCase()
    if (!q) return medicos
    return medicos.filter((m) => m.nombre.toLowerCase().includes(q) || m.especialidad.toLowerCase().includes(q) || m.hospital.toLowerCase().includes(q))
  })()

  const selectedMedico = medicos.find((m) => m.id === selectedMedicoId) || null
  const ubicaciones = selectedMedico?.ubicaciones || []

  const handleSelectMedico = (id: string) => {
    setSelectedMedicoId(id)
    const m = medicos.find((x) => x.id === id)
    if (m) setSelectedUbicacionId(m.ubicaciones[0]?.id || '')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const medico = selectedMedico
    const ubic = ubicaciones.find(u => u.id === selectedUbicacionId)
    // Cliente y Dirección se obtienen automáticamente del médico/ubicación seleccionada
    console.log('[Visita Extraordinaria] payload', {
      medico,
      ubicacion: ubic,
      cartera: medico?.visitadorAsignado,
      observaciones,
      exigencias,
      fecha: new Date().toISOString(),
    })
    alert(`Visita extraordinaria registrada${medico ? ` para ${medico.nombre}` : ''}${ubic ? ` en ${ubic.direccion}` : ''}`)
  }

  return (
    <div className="registro-page">
      <header className="registro-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Visita Extraordinaria</h1>
        <button className="icon-btn notification-btn" aria-label="Notificaciones" onClick={() => onNavigate('notificaciones')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <span className="notification-dot" />
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate} currentView={currentView} onLogout={onLogout} />

      <div className="registro-content">
        <form className="registro-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Buscar médico</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg style={{ position: 'absolute', left: 12 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a9ab5" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Buscar por nombre o especialidad..." value={searchMedico} onChange={e => setSearchMedico(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, maxHeight: 180, overflowY: 'auto' }}>
              {filteredMedicos.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectMedico(m.id)}
                  className="form-input"
                  style={{
                    height: 'auto',
                    padding: '8px 12px',
                    textAlign: 'left',
                    background: selectedMedicoId === m.id ? '#1B2A4E' : '#fff',
                    color: selectedMedicoId === m.id ? '#fff' : '#1B2A4E',
                    borderColor: selectedMedicoId === m.id ? '#1B2A4E' : '#e2e6ed',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{m.nombre}</span>
                  <span style={{ fontSize: 11, opacity: 0.8 }}>{m.especialidad} · {m.hospital}</span>
                </button>
              ))}
              {filteredMedicos.length === 0 && <span style={{ fontSize: 12, color: '#8a9ab5', padding: 8 }}>{medicos.length === 0 ? 'Sin médicos en la base de datos - sin datos en BD' : 'Sin resultados'}</span>}
            </div>
          </div>

          {selectedMedico && (
            <>
              <div className="form-group">
                <label className="form-label">Ubicación</label>
                <select className="form-input" value={selectedUbicacionId} onChange={e => setSelectedUbicacionId(e.target.value)}>
                  {ubicaciones.map(u => (
                    <option key={u.id} value={u.id}>{u.direccion} {u.detalle ? `— ${u.detalle}` : ''}</option>
                  ))}
                </select>
              </div>
              <div style={{ background: '#f8f9fb', border: '1px solid #eef1f5', borderRadius: 10, padding: 10, fontSize: 12, color: '#1B2A4E' }}>
                <span style={{ fontWeight: 700 }}>Cartera:</span> {selectedMedico.visitadorAsignado ? `${selectedMedico.visitadorAsignado}` : 'Sin asignar (visita fuera de cartera)'}
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea className="form-textarea" rows={3} placeholder="Detalle los puntos clave discutidos en la reunión..." value={observaciones} onChange={e => setObservaciones(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Exigencias / Acuerdos</label>
            <textarea className="form-textarea" rows={3} placeholder="Plazos de entrega, cotizaciones adicionales requeridas..." value={exigencias} onChange={e => setExigencias(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Firma Digital del Cliente</label>
            <div className="signature-wrapper">
              <canvas
                ref={canvasRef}
                className="signature-canvas"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {!hasSignature && <span className="signature-placeholder">Firmar aquí</span>}
              {hasSignature && (
                <button type="button" className="signature-clear" onClick={clearSignature}>
                  Limpiar
                </button>
              )}
              <div className="signature-line" />
            </div>
          </div>

          <button type="submit" className="btn-submit">
            Enviar Reporte
          </button>
        </form>
      </div>
    </div>
  )
}

// Backward compat old name
export const VisitRegistration = VisitRegistrationView
