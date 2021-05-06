import { isUserDescriptionValid, isUserUsernameValid } from './users'
import { EtoB, exists } from './misc'

function isAccountNameValid (value: string) {
  return EtoB(isUserUsernameValid)(value)
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
