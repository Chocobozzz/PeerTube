import { JobState } from '@peertube/peertube-models'
import { jobTypes } from '@server/lib/job-queue/job-queue.js'
import { exists } from './misc.js'

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
