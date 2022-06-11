import { exists, isArray } from './misc'
import { FollowState } from '@shared/models'

function isFollowStateValid (value: FollowState) {
  if (!exists(value)) return false

  return value === 'pending' || value === 'accepted'
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
