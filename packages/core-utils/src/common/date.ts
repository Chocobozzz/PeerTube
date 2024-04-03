function isToday (d: Date) {
  const today = new Date()

  return areDatesEqual(d, today)
}

function isYesterday (d: Date) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  return areDatesEqual(d, yesterday)
}

function isThisWeek (d: Date) {
  const minDateOfThisWeek = new Date()
  minDateOfThisWeek.setHours(0, 0, 0)

  // getDay() -> Sunday - Saturday : 0 - 6
  // We want to start our week on Monday
  let dayOfWeek = minDateOfThisWeek.getDay() - 1
  if (dayOfWeek < 0) dayOfWeek = 6 // Sunday

  minDateOfThisWeek.setDate(minDateOfThisWeek.getDate() - dayOfWeek)

  return d >= minDateOfThisWeek
}

function isThisMonth (d: Date) {
  const thisMonth = new Date().getMonth()

  return d.getMonth() === thisMonth
}

function isLastMonth (d: Date) {
  const now = new Date()

  return getDaysDifferences(now, d) <= 30
}

function isLastWeek (d: Date) {
  const now = new Date()

  return getDaysDifferences(now, d) <= 7
}

// ---------------------------------------------------------------------------

export const timecodeRegexString = `(\\d+[h:])?(\\d+[m:])?\\d+s?`

function timeToInt (time: number | string) {
  if (!time) return 0
  if (typeof time === 'number') return Math.floor(time)

  // Try with 00h00m00s format first
  const reg = new RegExp(`^((?<hours>\\d+)h)?((?<minutes>\\d+)m)?((?<seconds>\\d+)s?)?$`)
  const matches = time.match(reg)

  if (matches) {
    const hours = parseInt(matches.groups['hours'] || '0', 10)
    const minutes = parseInt(matches.groups['minutes'] || '0', 10)
    const seconds = parseInt(matches.groups['seconds'] || '0', 10)

    return hours * 3600 + minutes * 60 + seconds
  }

  // ':' format fallback
  const parts = time.split(':').reverse()

  const iMultiplier = {
    0: 1,
    1: 60,
    2: 3600
  }

  let result = 0
  for (let i = 0; i < parts.length; i++) {
    const partInt = parseInt(parts[i], 10)
    if (isNaN(partInt)) return 0

    result += iMultiplier[i] * partInt
  }

  return result
}

function secondsToTime (options: {
  seconds: number
  format: 'short' | 'full' | 'locale-string' // default 'short'
  symbol?: string
} | number) {
  let seconds: number
  let format: 'short' | 'full' | 'locale-string' = 'short'
  let symbol: string

  if (typeof options === 'number') {
    seconds = options
  } else {
    seconds = options.seconds
    format = options.format ?? 'short'
    symbol = options.symbol
  }

  let time = ''

  if (seconds === 0 && format !== 'full') return '0s'

  const formatNumber = (value: number) => {
    if (format === 'locale-string') return value.toLocaleString()

    return value
  }

  const hourSymbol = (symbol || 'h')
  const minuteSymbol = (symbol || 'm')
  const secondsSymbol = format === 'full' ? '' : 's'

  const hours = Math.floor(seconds / 3600)
  if (hours >= 1 && hours < 10 && format === 'full') time = '0' + hours + hourSymbol
  else if (hours >= 1) time = formatNumber(hours) + hourSymbol
  else if (format === 'full') time = '00' + hourSymbol

  seconds %= 3600
  const minutes = Math.floor(seconds / 60)
  if (minutes >= 1 && minutes < 10 && format === 'full') time += '0' + minutes + minuteSymbol
  else if (minutes >= 1) time += formatNumber(minutes) + minuteSymbol
  else if (format === 'full') time += '00' + minuteSymbol

  seconds %= 60
  if (seconds >= 1 && seconds < 10 && format === 'full') time += '0' + seconds + secondsSymbol
  else if (seconds >= 1) time += formatNumber(seconds) + secondsSymbol
  else if (format === 'full') time += '00'

  return time
}

// ---------------------------------------------------------------------------

export {
  isYesterday,
  isThisWeek,
  isThisMonth,
  isToday,
  isLastMonth,
  isLastWeek,
  timeToInt,
  secondsToTime
}

// ---------------------------------------------------------------------------

function areDatesEqual (d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

function getDaysDifferences (d1: Date, d2: Date) {
  return (d1.getTime() - d2.getTime()) / (86400000)
}
