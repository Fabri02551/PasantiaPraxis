import { useState, useRef, useEffect } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import './CompletarVisita.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos' | 'comentarios' | 'historial' | 'cartera' | 'completar-visita'

type MedicoInfo = { nombre: string; especialidad: string; hospital: string; phone: string }

export type VisitaACompletar = {
  id: string
  company: string
  detail: string
  addr: string
  time: string
  dateLabel?: string
  medico: MedicoInfo
  contact?: string
  phone?: string
  status?: string
}

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
  visita: VisitaACompletar | null
}

export const CompletarVisitaView: React.FC<Props> = ({ onNavigate, currentView, onLogout, visita }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [observaciones, setObservaciones] = useState('')
  const [exigencias, setExigencias] = useState('')
  const [hasSignature, setHasSignature] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
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
    canvasRef.current?.getContext('2d')?.closePath()
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!visita) {
      alert('No hay visita seleccionada')
      return
    }
    console.log('[CompletarVisita] payload', {
      visita,
      observaciones,
      exigencias,
      hasSignature,
      fecha: new Date().toISOString(),
    })
    alert(`Visita completada para ${visita.medico.nombre} - ${visita.company}`)
    onNavigate('home')
  }

  if (!visita) {
    return (
      <div className="completar-page">
        <header className="completar-header">
          <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          <h1 className="header-title">Completar Visita</h1>
          <span style={{ width: 36 }} />
        </header>
        <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate as any} currentView={currentView as any} onLogout={onLogout} />
        <div className="completar-content">
          <p style={{ textAlign: 'center', color: '#6b7a99', marginTop: 40 }}>No hay visita seleccionada. Vuelve a Visitas programadas o Calendario y pulsa Completar visita.</p>
          <button className="btn-submit" style={{ marginTop: 16 }} onClick={() => onNavigate('home')}>Volver</button>
        </div>
      </div>
    )
  }

  return (
    <div className="completar-page">
      <header className="completar-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
        <h1 className="header-title">Completar Visita</h1>
        <button className="icon-btn" aria-label="Volver" onClick={() => onNavigate('home')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </header>

      <SidebarMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={onNavigate as any} currentView={currentView as any} onLogout={onLogout} />

      <div className="completar-content">
        <form className="completar-form" onSubmit={handleSubmit}>
          <div className="completar-visita-info">
            <h2 className="completar-company">{visita.company}</h2>
            <p className="completar-detail">{visita.detail}</p>
            <p className="completar-addr">{visita.addr} · {visita.time} {visita.dateLabel ? `· ${visita.dateLabel}` : ''}</p>
            {visita.status && <span className={`completar-status status-${visita.status.toLowerCase().replace(' ','-')}`}>{visita.status}</span>}
          </div>

          {/* Detalles del médico como texto, no en recuadro */}
          <div className="completar-medico-text">
            <h3 className="completar-medico-title">Médico asignado</h3>
            <p className="completar-medico-line"><strong>Nombre:</strong> {visita.medico.nombre}</p>
            <p className="completar-medico-line"><strong>Especialidad:</strong> {visita.medico.especialidad}</p>
            <p className="completar-medico-line"><strong>Hospital:</strong> {visita.medico.hospital}</p>
            <p className="completar-medico-line"><strong>Teléfono:</strong> {visita.medico.phone}</p>
            {visita.contact && <p className="completar-medico-line"><strong>Contacto:</strong> {visita.contact}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea className="form-textarea" rows={3} placeholder="Detalle los puntos clave observados..." value={observaciones} onChange={e => setObservaciones(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Exigencias / Acuerdos</label>
            <textarea className="form-textarea" rows={3} placeholder="Plazos, acuerdos, exigencias del cliente..." value={exigencias} onChange={e => setExigencias(e.target.value)} />
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
              {hasSignature && <button type="button" className="signature-clear" onClick={clearSignature}>Limpiar</button>}
              <div className="signature-line" />
            </div>
          </div>

          <button type="submit" className="btn-submit">Completar visita</button>
        </form>
      </div>
    </div>
  )
}
