import validator from 'validator'
import { CONSTRAINTS_FIELDS, USER_REGISTRATION_STATES } from '../../initializers/constants.js'
import { exists, isArray } from './misc.js'

const USER_REGISTRATIONS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.USER_REGISTRATIONS

export function isRegistrationStateValid (value: string) {
  return exists(value) && USER_REGISTRATION_STATES[value] !== undefined
}

export function isRegistrationStateArrayValid (value: any) {
  return isArray(value) && value.every(v => isRegistrationStateValid(v))
}

export function isRegistrationModerationResponseValid (value: string) {
  return exists(value) && validator.default.isLength(value, USER_REGISTRATIONS_CONSTRAINTS_FIELDS.MODERATOR_MESSAGE)
}

export function isRegistrationReasonValid (value: string) {
  return exists(value) && validator.default.isLength(value, USER_REGISTRATIONS_CONSTRAINTS_FIELDS.REASON_MESSAGE)
}
