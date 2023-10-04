import { logger } from '@server/helpers/logger.js'

function buildGroupByAndBoundaries (startDateString: string, endDateString: string) {
  const startDate = new Date(startDateString)
  const endDate = new Date(endDateString)

  const groupInterval = buildGroupInterval(startDate, endDate)

  logger.debug('Found "%s" group interval.', groupInterval, { startDate, endDate })

  // Remove parts of the date we don't need
  if (groupInterval.endsWith(' month') || groupInterval.endsWith(' months')) {
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)
  } else if (groupInterval.endsWith(' day') || groupInterval.endsWith(' days')) {
    startDate.setHours(0, 0, 0, 0)
  } else if (groupInterval.endsWith(' hour') || groupInterval.endsWith(' hours')) {
    startDate.setMinutes(0, 0, 0)
  } else {
    startDate.setSeconds(0, 0)
  }

  return {
    groupInterval,
    startDate,
    endDate
  }
}

// ---------------------------------------------------------------------------

export {
  buildGroupByAndBoundaries
}

// ---------------------------------------------------------------------------

function buildGroupInterval (startDate: Date, endDate: Date): string {
  const aYear = 31536000
  const aMonth = 2678400
  const aDay = 86400
  const anHour = 3600
  const aMinute = 60

  const diffSeconds = (endDate.getTime() - startDate.getTime()) / 1000

  if (diffSeconds >= 6 * aYear) return '6 months'
  if (diffSeconds >= 2 * aYear) return '1 month'
  if (diffSeconds >= 6 * aMonth) return '7 days'
  if (diffSeconds >= 2 * aMonth) return '2 days'

  if (diffSeconds >= 15 * aDay) return '1 day'
  if (diffSeconds >= 8 * aDay) return '12 hours'
  if (diffSeconds >= 4 * aDay) return '6 hours'

  if (diffSeconds >= 15 * anHour) return '1 hour'

  if (diffSeconds >= 180 * aMinute) return '10 minutes'

  return '1 minute'
}
