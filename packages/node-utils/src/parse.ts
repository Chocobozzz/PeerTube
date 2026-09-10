// Parse the human readable values a configuration file may hold: "5 minutes", "1GB"

const timeTable = {
  ms: 1,
  second: 1000,
  minute: 60000,
  hour: 3600000,
  day: 3600000 * 24,
  week: 3600000 * 24 * 7,
  month: 3600000 * 24 * 30,
  year: 3600000 * 24 * 365
}

export function parseDurationToMs (duration: number | string): number {
  if (duration === null) return null
  if (typeof duration === 'number') return duration
  if (!isNaN(+duration)) return +duration

  if (typeof duration === 'string') {
    const split = duration.match(/^([\d.,]+)\s?(\w+)$/)

    if (split.length === 3) {
      const len = parseFloat(split[1])
      let unit = split[2].replace(/s$/i, '').toLowerCase()
      if (unit === 'm') {
        unit = 'ms'
      }

      const multiplier = timeTable[unit]
      if (!multiplier) throw new Error('Cannot parse datetime unit ' + unit)

      return (len || 1) * multiplier
    }
  }

  throw new Error(`Duration ${duration} could not be properly parsed`)
}

export function parseBytes (value: string | number): number {
  if (typeof value === 'number') return value
  if (!isNaN(+value)) return +value

  const tgm = /^(\d+)\s*TB\s*(\d+)\s*GB\s*(\d+)\s*MB$/
  const tg = /^(\d+)\s*TB\s*(\d+)\s*GB$/
  const tm = /^(\d+)\s*TB\s*(\d+)\s*MB$/
  const gm = /^(\d+)\s*GB\s*(\d+)\s*MB$/
  const t = /^(\d+)\s*TB$/
  const g = /^(\d+)\s*GB$/
  const m = /^(\d+)\s*MB$/
  const b = /^(\d+)\s*(?:KB|B)$/

  let match: RegExpMatchArray

  if (value.match(tgm)) {
    match = value.match(tgm)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024 * 1024 +
      parseInt(match[2], 10) * 1024 * 1024 * 1024 +
      parseInt(match[3], 10) * 1024 * 1024
  }

  if (value.match(tg)) {
    match = value.match(tg)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024 * 1024 +
      parseInt(match[2], 10) * 1024 * 1024 * 1024
  }

  if (value.match(tm)) {
    match = value.match(tm)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024 * 1024 +
      parseInt(match[2], 10) * 1024 * 1024
  }

  if (value.match(gm)) {
    match = value.match(gm)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024 +
      parseInt(match[2], 10) * 1024 * 1024
  }

  if (value.match(t)) {
    match = value.match(t)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024 * 1024
  }

  if (value.match(g)) {
    match = value.match(g)
    return parseInt(match[1], 10) * 1024 * 1024 * 1024
  }

  if (value.match(m)) {
    match = value.match(m)
    return parseInt(match[1], 10) * 1024 * 1024
  }

  if (value.match(b)) {
    match = value.match(b)
    return parseInt(match[1], 10) * 1024
  }

  return parseInt(value, 10)
}
