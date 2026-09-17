import { useEffect } from 'react'
import './Toast.css'

export type ToastType = 'success' | 'error' | 'info'

interface Props {
  message: string
  type?: ToastType
  onClose: () => void
  duration?: number
}

export const Toast: React.FC<Props> = ({ message, type = 'info', onClose, duration = 3500 }) => {
  useEffect(() => {
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [onClose, duration])

  return (
    <div className={`toast toast--${type}`} role="alert" aria-live="polite">
      <span className="toast-dot" />
      <span className="toast-msg">{message}</span>
      <button className="toast-close" onClick={onClose} aria-label="Cerrar">×</button>
    </div>
  )
}
