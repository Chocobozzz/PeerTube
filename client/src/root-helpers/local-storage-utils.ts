export function getBoolOrDefault (value: string, defaultValue: boolean) {
  if (value === 'true') return true
  if (value === 'false') return false

  return defaultValue
}

export function getNumberOrDefault (value: string, defaultValue: number) {
  if (!value) return defaultValue

  const result = parseInt(value, 10)
  if (isNaN(result)) return defaultValue

  return result
}
