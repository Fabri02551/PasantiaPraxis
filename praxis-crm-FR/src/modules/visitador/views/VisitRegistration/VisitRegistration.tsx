import { useRef, useState, useEffect } from 'react'
import { SidebarMenu } from '../../components/SidebarMenu/SidebarMenu'
import './VisitRegistration.css'

type View = 'home' | 'registro' | 'calendario' | 'planificador' | 'perfil' | 'notificaciones' | 'medicos'

interface Props {
  onNavigate: (view: View) => void
  currentView: View
  onLogout: () => void
}

export const VisitRegistrationView: React.FC<Props> = ({ onNavigate, currentView, onLogout }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoName, setPhotoName] = useState<string | null>(null)

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setPhotoName(file.name)
  }

  return (
    <div className="registro-page">
      <header className="registro-header">
        <button className="icon-btn" aria-label="Menú" onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <h1 className="header-title">Registro de Visita</h1>
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
        <form className="registro-form" onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label className="form-label">Cliente</label>
            <input className="form-input" placeholder="Nombre de la empresa o contacto" />
          </div>

          <div className="form-group">
            <label className="form-label">Dirección</label>
            <input className="form-input" placeholder="Av. Principal #123, Oficina 402" />
          </div>

          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea className="form-textarea" rows={3} placeholder="Detalle los puntos clave discutidos en la reunión..." />
          </div>

          <div className="form-group">
            <label className="form-label">Exigencias / Acuerdos</label>
            <textarea className="form-textarea" rows={3} placeholder="Plazos de entrega, cotizaciones adicionales requeridas..." />
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

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} hidden />

          <button type="button" className="btn-photo" onClick={() => fileInputRef.current?.click()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2D9C9C" strokeWidth="1.8">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            {photoName ? photoName : 'Subir Foto de Respaldo'}
          </button>

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
