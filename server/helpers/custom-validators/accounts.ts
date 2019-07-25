import { isUserDescriptionValid, isUserUsernameValid } from './users'
import { exists } from './misc'

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
