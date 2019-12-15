import { JobState } from '../../../shared/models'
import { exists } from './misc'
import { jobTypes } from '@server/lib/job-queue/job-queue'

const jobStates: JobState[] = [ 'active', 'completed', 'failed', 'waiting', 'delayed' ]

function isValidJobState (value: JobState) {
  return exists(value) && jobStates.includes(value)
}

function isValidJobType (value: any) {
  return exists(value) && jobTypes.includes(value)
}

// ---------------------------------------------------------------------------

export {
  isValidJobState,
  isValidJobType
}
