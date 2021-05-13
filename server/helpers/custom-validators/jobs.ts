import { JobState } from '../../../shared/models'
import { exists } from './misc'
import { jobTypes } from '@server/lib/job-queue/job-queue'

const jobStates: JobState[] = [ 'active', 'completed', 'failed', 'waiting', 'delayed', 'paused' ]

/**
 * @throws {Error}
 */
function checkJobState (value: JobState) {
  if (!exists(value)) throw new Error('Should have a job state')
  if (!jobStates.includes(value)) throw new Error('Should have a job state among ' + jobStates.join(', '))
  return true
}

/**
 * @throws {Error}
 */
function checkJobType (value: any) {
  if (!exists(value)) throw new Error('Should have a job type')
  if (!jobTypes.includes(value)) throw new Error('Should have a job type among ' + jobTypes.join(', '))
  return true
}

// ---------------------------------------------------------------------------

export {
  jobStates,
  checkJobState,
  checkJobType
}
