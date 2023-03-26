import validator from 'validator'
import { CONSTRAINTS_FIELDS, USER_REGISTRATION_STATES } from '../../initializers/constants'
import { exists } from './misc'

const USER_REGISTRATIONS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.USER_REGISTRATIONS

function isRegistrationStateValid (value: string) {
  return exists(value) && USER_REGISTRATION_STATES[value] !== undefined
}

function isRegistrationModerationResponseValid (value: string) {
  return exists(value) && validator.isLength(value, USER_REGISTRATIONS_CONSTRAINTS_FIELDS.MODERATOR_MESSAGE)
}

function isRegistrationReasonValid (value: string) {
  return exists(value) && validator.isLength(value, USER_REGISTRATIONS_CONSTRAINTS_FIELDS.REASON_MESSAGE)
}

// ---------------------------------------------------------------------------

export {
  isRegistrationStateValid,
  isRegistrationModerationResponseValid,
  isRegistrationReasonValid
}
