import './SuccessModal.css'

export type CreatedKind = 'medico' | 'visitador' | 'administrador' | 'institucion' | 'persona'

interface Props {
  open: boolean
  onClose: () => void
  kind: CreatedKind
  /** Nombre de la persona o institución creada */
  name: string
  /** Línea extra opcional (ej. matrícula, correo, NIT) */
  detail?: string
}

const COPY: Record<CreatedKind, { title: string; message: (name: string) => string; badge: string }> = {
  medico: {
    title: 'Médico creado',
    message: (n) => `El médico ${n} ha sido creado correctamente y ya está disponible en el sistema.`,
    badge: 'Persona · Médico',
  },
  visitador: {
    title: 'Visitador creado',
    message: (n) => `El visitador ${n} ha sido creado correctamente y ya está disponible en el sistema.`,
    badge: 'Persona · Visitador',
  },
  administrador: {
    title: 'Administrador creado',
    message: (n) => `El administrador ${n} ha sido creado correctamente y ya está disponible en el sistema.`,
    badge: 'Persona · Administrador',
  },
  institucion: {
    title: 'Institución creada',
    message: (n) => `La institución ${n} ha sido creada correctamente y ya está disponible en el sistema.`,
    badge: 'Institución',
  },
  persona: {
    title: 'Persona creada',
    message: (n) => `La persona ${n} ha sido creada correctamente y ya está disponible en el sistema.`,
    badge: 'Persona',
  },
}

/**
 * Modal global de confirmación de creación.
 * Se usa al crear personas (médicos, visitadores, administradores)
 * e instituciones: indica QUÉ se creó y con qué nombre.
 */
export const SuccessModal: React.FC<Props> = ({ open, onClose, kind, name, detail }) => {
  if (!open) return null
  const copy = COPY[kind] ?? COPY.persona

  return (
    <div className="success-overlay" onClick={onClose} role="presentation">
      <div
        className="success-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-label={copy.title}
      >
        <div className="success-main">
          <div className="success-icon" aria-hidden>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <div className="success-text">
            <span className="success-badge">{copy.badge}</span>
            <h3 className="success-title">¡{copy.title} con éxito!</h3>
            <p className="success-message">{copy.message(name || 'El registro')}</p>
            {detail && <p className="success-detail">{detail}</p>}
          </div>
        </div>
        <button className="success-btn" onClick={onClose} autoFocus>
          Entendido
        </button>
      </div>
    </div>
  )
}
