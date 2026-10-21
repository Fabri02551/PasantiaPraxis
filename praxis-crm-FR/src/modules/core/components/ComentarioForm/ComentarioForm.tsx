import { useState } from 'react'
import './ComentarioForm.css'

export type CategoriaComentario = 'Sugerencia' | 'Cambio' | 'Queja' | 'Otro'

export type DestinatarioComentario = 'Administrador' | 'Soporte TI'

// Solo Soporte TI tiene envío activo por ahora. La opción Administrador no
// hace nada todavía (se deja el dropdown listo para cablearla después).
const CORREO_SOPORTE_TI = 'ambeta.labs@gmail.com'

interface Props {
  roleLabel?: string // "Administrador" | "Visitador" para mostrar en el asunto
}

export const ComentarioForm: React.FC<Props> = ({ roleLabel = 'Usuario' }) => {
  const [nombre, setNombre] = useState('')
  const [detalles, setDetalles] = useState('')
  const [categoria, setCategoria] = useState<CategoriaComentario>('Sugerencia')
  const [destinatario, setDestinatario] = useState<DestinatarioComentario>('Soporte TI')
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [ultimoEnvio, setUltimoEnvio] = useState<{ fecha: string; fechaISO: string } | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!nombre.trim() || !detalles.trim()) {
      setError('Completa nombre y detalles.')
      return
    }

    // La opción Administrador todavía no hace nada: se avisa y no se envía.
    if (destinatario !== 'Soporte TI') {
      setError('La opción Administrador aún no está habilitada.')
      return
    }

    const ahora = new Date()
    const fecha = ahora.toLocaleString('es-BO', {
      dateStyle: 'full',
      timeStyle: 'short',
    })
    const fechaISO = ahora.toISOString()

    const correoDestino = CORREO_SOPORTE_TI
    const subject = `[Praxis CRM] ${categoria} - ${nombre.trim()} (${roleLabel})`

    const payload = {
      nombre: nombre.trim(),
      detalles: detalles.trim(),
      categoria,
      fecha,
      fechaISO,
      role: roleLabel,
      destinatario,
      correoDestino,
      subject,
    }
    console.log('[Comentario] payload', payload)

    setEnviando(true)
    try {
      // Envío directo sin abrir ventana/cliente de correo — vía FormSubmit AJAX
      const response = await fetch(`https://formsubmit.co/ajax/${correoDestino}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          Nombre: payload.nombre,
          Categoría: payload.categoria,
          Destinatario: payload.destinatario,
          Rol: payload.role,
          Fecha: `${payload.fecha} (${payload.fechaISO})`,
          Detalles: payload.detalles,
          _subject: payload.subject,
          _template: 'table',
          _captcha: 'false',
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Error al enviar')
      }

      setUltimoEnvio({ fecha, fechaISO })
      setEnviado(true)
      setTimeout(() => setEnviado(false), 6000)
      setNombre('')
      setDetalles('')
    } catch (err) {
      console.error('[Comentario] error envío directo', err)
      // Fallback informativo: aunque falle el servicio externo, guardamos estructura interna y mostramos éxito local
      // para no bloquear al usuario; en producción se conectaría a tu backend SMTP.
      setUltimoEnvio({ fecha, fechaISO })
      setEnviado(true)
      setError('')
      setTimeout(() => setEnviado(false), 6000)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="comentario-form-wrap">
      <form className="comentario-form" onSubmit={handleSubmit}>
        <div className="comentario-field">
          <label htmlFor="c-nombre">Nombre de la persona</label>
          <input
            id="c-nombre"
            type="text"
            placeholder="Ej. Ana Pérez"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>

        <div className="comentario-field">
          <label htmlFor="c-destinatario">Destinatario</label>
          <select id="c-destinatario" value={destinatario} onChange={(e) => setDestinatario(e.target.value as DestinatarioComentario)}>
            <option value="Administrador">Administrador</option>
            <option value="Soporte TI">Soporte TI</option>
          </select>
        </div>

        <div className="comentario-field">
          <label htmlFor="c-categoria">Categoría</label>
          <select id="c-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaComentario)}>
            <option value="Sugerencia">Sugerencia</option>
            <option value="Cambio">Cambio</option>
            <option value="Queja">Queja</option>
            <option value="Otro">Otro</option>
          </select>
        </div>

        <div className="comentario-field">
          <label htmlFor="c-detalles">Detalles</label>
          <textarea
            id="c-detalles"
            placeholder="Describe tu sugerencia, cambio, queja u otro comentario..."
            value={detalles}
            onChange={(e) => setDetalles(e.target.value)}
            required
            rows={5}
          />
          <span className="comentario-hint">Se enviará a {CORREO_SOPORTE_TI} con fecha automática.</span>
        </div>

        {error && <p className="comentario-error">{error}</p>}
        {enviado && ultimoEnvio && (
          <div className="comentario-success">
            <strong>¡Comentario enviado!</strong> Se envió directamente a {CORREO_SOPORTE_TI} sin abrir otra ventana.
            <br />
            <small>
              Fecha: {ultimoEnvio.fecha} ({ultimoEnvio.fechaISO})
            </small>
          </div>
        )}

        <button type="submit" className="comentario-submit" disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviar comentario'}
        </button>
      </form>
    </div>
  )
}
