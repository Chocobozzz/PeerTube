import { exists } from './misc'
import { FollowState } from '@shared/models'

function isFollowStateValid (value: FollowState) {
  if (!exists(value)) return false

  return value === 'pending' || value === 'accepted'
}

// ---------------------------------------------------------------------------

export {
  isFollowStateValid
}
