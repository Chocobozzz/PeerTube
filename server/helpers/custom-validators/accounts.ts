import { checkUserDescription, isUserUsernameValid } from './users'
import { exists } from './misc'

/**
 * @throws {Error}
 */
function checkAccountName (value: string) {
  return isUserUsernameValid(value)
}

function isAccountIdValid (value: string) {
  return exists(value)
}

/**
 * @throws {Error}
 */
function isAccountDescriptionValid (value: string) {
  return checkUserDescription(value)
}

// ---------------------------------------------------------------------------

export {
  isAccountIdValid,
  isAccountDescriptionValid,
  checkAccountName
}
