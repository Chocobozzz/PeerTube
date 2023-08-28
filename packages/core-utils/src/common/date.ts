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

export const timecodeRegexString = `((\\d+)[h:])?((\\d+)[m:])?((\\d+)s?)?`

function timeToInt (time: number | string) {
  if (!time) return 0
  if (typeof time === 'number') return time

  const reg = new RegExp(`^${timecodeRegexString}$`)
  const matches = time.match(reg)

  if (!matches) return 0

  const hours = parseInt(matches[2] || '0', 10)
  const minutes = parseInt(matches[4] || '0', 10)
  const seconds = parseInt(matches[6] || '0', 10)

  return hours * 3600 + minutes * 60 + seconds
}

function secondsToTime (seconds: number, full = false, symbol?: string) {
  let time = ''

  if (seconds === 0 && !full) return '0s'

  const hourSymbol = (symbol || 'h')
  const minuteSymbol = (symbol || 'm')
  const secondsSymbol = full ? '' : 's'

  const hours = Math.floor(seconds / 3600)
  if (hours >= 1) time = hours + hourSymbol
  else if (full) time = '0' + hourSymbol

  seconds %= 3600
  const minutes = Math.floor(seconds / 60)
  if (minutes >= 1 && minutes < 10 && full) time += '0' + minutes + minuteSymbol
  else if (minutes >= 1) time += minutes + minuteSymbol
  else if (full) time += '00' + minuteSymbol

  seconds %= 60
  if (seconds >= 1 && seconds < 10 && full) time += '0' + seconds + secondsSymbol
  else if (seconds >= 1) time += seconds + secondsSymbol
  else if (full) time += '00'

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
