export function maskSecret (secret: string) {
  if (!secret) return secret
  if (typeof secret !== 'string') return '****'

  if (secret.length <= 4) return '****'
  if (secret.length <= 8) return secret.slice(0, 2) + '***'

  return secret.slice(0, 4) + '****'
}
