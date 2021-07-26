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

export {
  isYesterday,
  isThisWeek,
  isThisMonth,
  isToday,
  isLastMonth,
  isLastWeek
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
