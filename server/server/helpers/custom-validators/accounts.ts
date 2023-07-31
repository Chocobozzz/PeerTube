import { isUserDescriptionValid, isUserUsernameValid } from './users.js'
import { exists } from './misc.js'

function isAccountNameValid (value: string) {
  return isUserUsernameValid(value)
}

function isAccountIdValid (value: string) {
  return exists(value)
}

function isAccountDescriptionValid (value: string) {
  return isUserDescriptionValid(value)
}

// ---------------------------------------------------------------------------

export {
  isAccountIdValid,
  isAccountDescriptionValid,
  isAccountNameValid
}
