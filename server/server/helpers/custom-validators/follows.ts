import { exists, isArray } from './misc.js'
import { FollowState } from '@peertube/peertube-models'

function isFollowStateValid (value: FollowState) {
  if (!exists(value)) return false

  return value === 'pending' || value === 'accepted' || value === 'rejected'
}

function isRemoteHandleValid (value: string) {
  if (!exists(value)) return false
  if (typeof value !== 'string') return false

  return value.includes('@')
}

function isEachUniqueHandleValid (handles: string[]) {
  return isArray(handles) &&
    handles.every(handle => {
      return isRemoteHandleValid(handle) && handles.indexOf(handle) === handles.lastIndexOf(handle)
    })
}

// ---------------------------------------------------------------------------

export {
  isFollowStateValid,
  isRemoteHandleValid,
  isEachUniqueHandleValid
}
