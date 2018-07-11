import { JobState } from '../../../shared/models'
import { exists } from './misc'

const jobStates: JobState[] = [ 'active', 'completed', 'failed', 'waiting', 'delayed' ]

function isValidJobState (value: JobState) {
  return exists(value) && jobStates.indexOf(value) !== -1
}

// ---------------------------------------------------------------------------

export {
  isValidJobState
}
