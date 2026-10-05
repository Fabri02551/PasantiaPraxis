/**
 * Avatar por iniciales con color determinista.
 * Ej: "Pablo Daniel Campos Dalence" -> "PC" (primera de nombre + primera de apellido).
 * Si solo hay un nombre, usa sus 2 primeras letras.
 */

const PALETTE = [
  ['#1B2A4E', '#2d9c9c'],
  ['#6d28d9', '#a855f7'],
  ['#0e7490', '#22d3ee'],
  ['#9a3412', '#f59e0b'],
  ['#166534', '#22c55e'],
  ['#9f1239', '#fb7185'],
  ['#1e40af', '#60a5fa'],
  ['#7c2d12', '#fb923c'],
]

export function getInitials(nombre?: string | null, primerApellido?: string | null, segundoApellido?: string | null): string {
  const n = (nombre || '').trim()
  const p1 = (primerApellido || '').trim()
  const p2 = (segundoApellido || '').trim()
  // Soporta "nombre completo" en un solo string: toma primera y última palabra
  if (!p1 && n.includes(' ')) {
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return n.slice(0, 2).toUpperCase()
  }
  const a = n ? n[0] : ''
  const b = p1 ? p1[0] : p2 ? p2[0] : ''
  const initials = (a + b).toUpperCase()
  if (initials) return initials
  // Fallback: 2 primeras letras de lo que haya
  return (n || p1 || p2 || 'AD').slice(0, 2).toUpperCase()
}

export function avatarColors(seed: string): { bg: string; fg: string; gradient: string } {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const [c1, c2] = PALETTE[h % PALETTE.length]
  return { bg: c1, fg: '#fff', gradient: `linear-gradient(135deg, ${c1}, ${c2})` }
}

export function avatarStyle(seed: string): React.CSSProperties {
  const c = avatarColors(seed)
  return { background: c.gradient, color: c.fg }
}
