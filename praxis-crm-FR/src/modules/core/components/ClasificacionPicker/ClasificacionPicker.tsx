import './ClasificacionPicker.css'

// Escala visual de clasificación (0-5). Los niveles se pintan con intensidad
// progresiva: el color más cargado = mayor importancia. El 0 es "sin clasificar".
export const NIVEL_CLASIFICACION = [
  { valor: 0, etiqueta: 'Sin', corta: 'Sin', tono: '#b7c1d4' },
  { valor: 1, etiqueta: 'Nivel 1 · Baja', corta: 'Baja', tono: '#93a4bd' },
  { valor: 2, etiqueta: 'Nivel 2 · Media', corta: 'Media', tono: '#4f7cc0' },
  { valor: 3, etiqueta: 'Nivel 3 · Alta', corta: 'Alta', tono: '#2d9c9c' },
  { valor: 4, etiqueta: 'Nivel 4 · Muy alta', corta: 'Muy alta', tono: '#e89b3c' },
  { valor: 5, etiqueta: 'Nivel 5 · Máxima', corta: 'Máxima', tono: '#e0436b' },
]

export const nivelClasificacion = (valor: number) =>
  NIVEL_CLASIFICACION.find(n => n.valor === valor) ?? NIVEL_CLASIFICACION[0]

interface Props {
  value: number
  onChange: (v: number) => void
}

// Selector visual de clasificación: un tile de color por nivel (0-5).
// Reemplaza al <select> simple: se entiende de un vistazo cuánto "pesa"
// el médico/institución para la visita.
export const ClasificacionPicker: React.FC<Props> = ({ value, onChange }) => {
  const actual = nivelClasificacion(value)
  return (
    <div className="cls-picker">
      <div className="cls-picker-head">
        <span>Clasificación</span>
        <span className="cls-picker-actual" style={{ color: actual.tono }}>{actual.etiqueta}</span>
      </div>
      <div className="cls-picker-opts" role="radiogroup" aria-label="Clasificación">
        {NIVEL_CLASIFICACION.map((n) => {
          const activo = n.valor === value
          return (
            <button
              key={n.valor}
              type="button"
              role="radio"
              aria-checked={activo}
              title={n.etiqueta}
              onClick={() => onChange(n.valor)}
              className={`cls-tile ${activo ? 'active' : ''} ${n.valor === 0 ? 'cero' : ''}`}
              style={{ '--cls-tono': n.tono } as React.CSSProperties}
            >
              <span className="cls-tile-dot" />
              <span className="cls-tile-label">{n.corta}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Chip compacto para mostrar la clasificación en tarjetas/detalles.
export const MiniClasificacion: React.FC<{ valor: number }> = ({ valor }) => {
  const n = nivelClasificacion(valor)
  return (
    <span className="cls-mini" style={{ background: `${n.tono}1a`, color: n.tono, borderColor: `${n.tono}55` }}>
      <span className="cls-mini-dot" style={{ background: n.tono }} />
      {valor === 0 ? 'Sin clasificar' : `${valor} · ${n.corta}`}
    </span>
  )
}