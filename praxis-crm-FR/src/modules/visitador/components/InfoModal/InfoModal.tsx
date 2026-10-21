import type { ReactElement } from 'react'
import './InfoModal.css'

export type InfoVariant = 'success' | 'error' | 'info'

export interface InfoDetail {
  label: string
  value: string
}

interface Props {
  open: boolean
  variant?: InfoVariant
  title: string
  message: string
  details?: InfoDetail[]
  acceptLabel?: string
  onAccept: () => void
}

const ICONS: Record<InfoVariant, ReactElement> = {
  success: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
}

/**
 * Modal global del lado visitador: reemplaza los `alert()` nativos con una
 * tarjeta ancha rectangular (web) que se adapta a móvil.
 */
export const InfoModal: React.FC<Props> = ({
  open,
  variant = 'info',
  title,
  message,
  details,
  acceptLabel = 'Aceptar',
  onAccept,
}) => {
  if (!open) return null

  return (
    <div className="info-overlay" onClick={onAccept} role="presentation">
      <div
        className={`info-modal info-modal--${variant}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-label={title}
      >
        <div className="info-main">
          <div className={`info-icon info-icon--${variant}`} aria-hidden>
            {ICONS[variant]}
          </div>
          <div className="info-text">
            <h3 className="info-title">{title}</h3>
            <p className="info-message">{message}</p>
            {details && details.length > 0 && (
              <dl className="info-details">
                {details.map((d) => (
                  <div key={d.label} className="info-detail-row">
                    <dt>{d.label}</dt>
                    <dd>{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
        <button className="info-btn" onClick={onAccept} autoFocus>
          {acceptLabel}
        </button>
      </div>
    </div>
  )
}
