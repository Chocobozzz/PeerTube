import { exists } from './misc'
import { FollowState } from '@shared/models'

function checkFollowState (value: FollowState) {
  if (!exists(value)) throw new Error('Should have a follow state')
  const possibleValues = [ 'pending', 'accepted' ]
  if (!possibleValues.includes(value)) throw new Error('Should have a follow state among ' + possibleValues.join(', '))
  return true
}

// ---------------------------------------------------------------------------

export {
  checkFollowState
}
