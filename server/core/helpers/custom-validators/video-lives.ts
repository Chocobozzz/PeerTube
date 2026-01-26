import { LiveVideoLatencyMode } from '@peertube/peertube-models'
import { isDateValid } from './misc.js'

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
