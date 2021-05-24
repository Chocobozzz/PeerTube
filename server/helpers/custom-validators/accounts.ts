import { checkUserDescription, checkUserUsername } from './users'
import { exists } from './misc'

function checkAccountName (value: string) {
  return checkUserUsername(value)
}

function isAccountIdValid (value: string) {
  return exists(value)
}

function checkAccountDescription (value: string) {
  return checkUserDescription(value)
}

// ---------------------------------------------------------------------------

export {
  isAccountIdValid,
  checkAccountDescription,
  checkAccountName
}
