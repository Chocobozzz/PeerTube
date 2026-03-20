import { LiveVideoLatencyMode } from '@peertube/peertube-models'
import validator from 'validator'
import { exists, isDateValid } from './misc.js'

export function isLiveLatencyModeValid (value: any) {
  return [ LiveVideoLatencyMode.DEFAULT, LiveVideoLatencyMode.SMALL_LATENCY, LiveVideoLatencyMode.HIGH_LATENCY ].includes(value)
}

export function isLiveScheduleValid (schedule: any) {
  return isDateValid(schedule?.startAt)
}

export function areLiveSchedulesValid (schedules: any[]) {
  if (!schedules) return true

  if (!Array.isArray(schedules)) return false

  return schedules.every(schedule => isLiveScheduleValid(schedule))
}

export function isLiveDvrWindowValid (value: unknown, maxDvrWindow: number) {
  return exists(value) && validator.default.isInt('' + value, { min: 0, max: maxDvrWindow })
}
