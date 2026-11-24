import { LiveVideoLatencyMode } from '@peertube/peertube-models'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import validator from 'validator'
import { exists, isDateValid } from './misc.js'

export function isLiveLatencyModeValid (value: any) {
  return [ LiveVideoLatencyMode.DEFAULT, LiveVideoLatencyMode.SMALL_LATENCY, LiveVideoLatencyMode.HIGH_LATENCY ].includes(value)
}

export function isLiveScheduleValid (schedule: any) {
  return typeof schedule?.startAt === 'string' && isDateValid(schedule.startAt)
}

export function areLiveSchedulesValid (schedules: any[]) {
  if (!schedules) return true

  if (!Array.isArray(schedules)) return false
  if (schedules.length > CONSTRAINTS_FIELDS.VIDEO_LIVES.SCHEDULES.max) return false

  return schedules.every(schedule => isLiveScheduleValid(schedule))
}

export function isLiveDvrWindowValid (value: unknown, maxDvrWindow: number) {
  return exists(value) && validator.default.isInt('' + value, { min: 0, max: maxDvrWindow })
}
