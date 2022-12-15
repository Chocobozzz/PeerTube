function getBoolOrDefault (value: string, defaultValue: boolean) {
  if (value === 'true') return true
  if (value === 'false') return false

  return defaultValue
}

export {
  getBoolOrDefault
}
