import './Paginador.css'

type Props = {
  page: number
  totalPages: number
  onPage: (page: number) => void
  loading?: boolean
}

function rango(pages: number[], page: number, total: number): number[] {
  const visibles = 5
  if (total <= visibles) return pages
  let start = Math.max(1, page - 2)
  const end = Math.min(total, start + visibles - 1)
  start = Math.max(1, end - visibles + 1)
  return pages.slice(start - 1, end)
}

export function Paginador({ page, totalPages, onPage, loading }: Props) {
  if (totalPages <= 1) return null
  const paginas = Array.from({ length: totalPages }, (_, i) => i + 1)
  return (
    <nav className="paginador" aria-label="Paginación">
      <button
        className="paginador-btn"
        disabled={page <= 1 || loading}
        onClick={() => onPage(page - 1)}
      >
        ‹ Anterior
      </button>
      <div className="paginador-nums">
        {rango(paginas, page, totalPages).map(n => (
          <button
            key={n}
            className={`paginador-num${n === page ? ' activo' : ''}`}
            disabled={loading}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <button
        className="paginador-btn"
        disabled={page >= totalPages || loading}
        onClick={() => onPage(page + 1)}
      >
        Siguiente ›
      </button>
    </nav>
  )
}