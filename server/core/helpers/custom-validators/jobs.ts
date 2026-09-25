import { JobState } from '@peertube/peertube-models'
import { PROCESS_ROLES } from '@server/initializers/process-role.js'
import { jobTypes } from '@server/lib/job-queue/job-queue.js'
import { exists, isArrayOf } from './misc.js'

export const allJobStates = new Set<JobState>([
  'active',
  'completed',
  'failed',
  'waiting',
  'delayed',
  'wait',
  'waiting-children',
  'prioritized',
  'repeat'
])

export function isValidJobState (value: JobState) {
  return exists(value) && allJobStates.has(value)
}

export function isValidJobType (value: any) {
  return exists(value) && jobTypes.includes(value)
}

export function isValidJobQueueProcessRoles (value: any) {
  return isArrayOf(value, v => PROCESS_ROLES.includes(v)) && value.length !== 0
}
