/**
 * Prefijo Dr./Dra. según persona.sexo
 * Masculino -> Dr., Femenino -> Dra., Otro/vacío -> sin prefijo (evita duplicar)
 */
export const sexoToPrefix = (sexo?: string | null): string => {
  const s = (sexo || '').toString().trim().toLowerCase()
  if (!s) return ''
  if (['f', 'femenino', 'mujer', 'dra', 'dra.'].includes(s)) return 'Dra.'
  if (['m', 'masculino', 'hombre', 'varon', 'varón', 'dr', 'dr.'].includes(s)) return 'Dr.'
  return ''
}

export const displayMedico = (sexo?: string | null, nombre?: string | null): string => {
  const base = (nombre || '').trim()
  if (!base) return ''
  if (base.startsWith('Dr. ') || base.startsWith('Dra. ')) return base
  const prefix = sexoToPrefix(sexo)
  return prefix ? `${prefix} ${base}` : base
}
