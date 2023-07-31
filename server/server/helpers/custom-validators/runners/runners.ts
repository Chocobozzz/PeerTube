import validator from 'validator'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import { exists } from '../misc.js'

const RUNNERS_CONSTRAINTS_FIELDS = CONSTRAINTS_FIELDS.RUNNERS

function isRunnerRegistrationTokenValid (value: string) {
  return exists(value) && validator.default.isLength(value, RUNNERS_CONSTRAINTS_FIELDS.TOKEN)
}

function isRunnerTokenValid (value: string) {
  return exists(value) && validator.default.isLength(value, RUNNERS_CONSTRAINTS_FIELDS.TOKEN)
}

function isRunnerNameValid (value: string) {
  return exists(value) && validator.default.isLength(value, RUNNERS_CONSTRAINTS_FIELDS.NAME)
}

function isRunnerDescriptionValid (value: string) {
  return exists(value) && validator.default.isLength(value, RUNNERS_CONSTRAINTS_FIELDS.DESCRIPTION)
}

// ---------------------------------------------------------------------------

export {
  isRunnerRegistrationTokenValid,
  isRunnerTokenValid,
  isRunnerNameValid,
  isRunnerDescriptionValid
}
