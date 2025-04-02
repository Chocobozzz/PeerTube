export function toTitleCase (str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const dictionaryBytes = [
  { max: 1024, type: 'B', decimals: 0 },
  { max: 1048576, type: 'KB', decimals: 0 },
  { max: 1073741824, type: 'MB', decimals: 0 },
  { max: 1.0995116e12, type: 'GB', decimals: 1 }
]
export function bytes (value: number) {
  const format = dictionaryBytes.find(d => value < d.max) || dictionaryBytes[dictionaryBytes.length - 1]
  const calc = (value / (format.max / 1024)).toFixed(format.decimals)

  return [ calc, format.type ]
}

export function getRtcConfig (stunServers: string[]) {
  return {
    iceServers: stunServers.map(s => ({ urls: s }))
  }
}

export function isSameOrigin (current: string, target: string) {
  return new URL(current).origin === new URL(target).origin
}
