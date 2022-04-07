import { logger } from '@server/helpers/logger'
import { VideoStatsTimeserieGroupInterval } from '@shared/models'

function buildGroupByAndBoundaries (startDateString: string, endDateString: string) {
  const startDate = new Date(startDateString)
  const endDate = new Date(endDateString)

  const groupByMatrix: { [ id in VideoStatsTimeserieGroupInterval ]: string } = {
    one_day: '1 day',
    one_hour: '1 hour',
    ten_minutes: '10 minutes',
    one_minute: '1 minute'
  }
  const groupInterval = buildGroupInterval(startDate, endDate)

  logger.debug('Found "%s" group interval.', groupInterval, { startDate, endDate })

  // Remove parts of the date we don't need
  if (groupInterval === 'one_day') {
    startDate.setHours(0, 0, 0, 0)
  } else if (groupInterval === 'one_hour') {
    startDate.setMinutes(0, 0, 0)
  } else {
    startDate.setSeconds(0, 0)
  }

  return {
    groupInterval,
    sqlInterval: groupByMatrix[groupInterval],
    startDate,
    endDate
  }
}

// ---------------------------------------------------------------------------

export {
  buildGroupByAndBoundaries
}

// ---------------------------------------------------------------------------

function buildGroupInterval (startDate: Date, endDate: Date): VideoStatsTimeserieGroupInterval {
  const aDay = 86400
  const anHour = 3600
  const aMinute = 60

  const diffSeconds = (endDate.getTime() - startDate.getTime()) / 1000

  if (diffSeconds >= 6 * aDay) return 'one_day'
  if (diffSeconds >= 6 * anHour) return 'one_hour'
  if (diffSeconds >= 60 * aMinute) return 'ten_minutes'

  return 'one_minute'
}
