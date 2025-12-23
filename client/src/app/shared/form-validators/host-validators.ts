import { AbstractControl, ValidatorFn, Validators } from '@angular/forms'
import { splitAndGetNotEmpty } from '@root-helpers/string'
import { BuildFormValidator } from './form-validator.model'
import { unique } from './shared/validator-utils'

export function validateHost (value: string) {
  // Thanks to http://stackoverflow.com/a/106223
  const HOST_REGEXP = new RegExp(
    '^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]).)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$'
  )

  return HOST_REGEXP.test(value)
}

export function validateHandle (value: string) {
  if (!value) return false

  return value.includes('@')
}

const validHosts: ValidatorFn = (control: AbstractControl) => {
  if (!control.value) return null

  const errors = []
  const hosts = splitAndGetNotEmpty(control.value)

  for (const host of hosts) {
    if (validateHost(host) === false) {
      errors.push($localize`${host} is not valid`)
    }
  }

  // valid
  if (errors.length === 0) return null

  return {
    validHosts: {
      reason: 'invalid',
      value: errors.join('. ') + '.'
    }
  }
}

const validHostsOrHandles: ValidatorFn = (control: AbstractControl) => {
  if (!control.value) return null

  const errors = []
  const lines = splitAndGetNotEmpty(control.value)

  for (const line of lines) {
    if (validateHost(line) === false && validateHandle(line) === false) {
      errors.push($localize`${line} is not valid`)
    }
  }

  // valid
  if (errors.length === 0) return null

  return {
    validHostsOrHandles: {
      reason: 'invalid',
      value: errors.join('. ') + '.'
    }
  }
}

// ---------------------------------------------------------------------------

export const UNIQUE_HOSTS_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, validHosts, unique ],
  MESSAGES: {
    required: $localize`Domain is required.`,
    validHosts: $localize`Hosts entered are invalid.`,
    unique: $localize`Hosts entered contain duplicates.`
  }
}

export const UNIQUE_HOSTS_OR_HANDLE_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [ Validators.required, validHostsOrHandles, unique ],
  MESSAGES: {
    required: $localize`Domain is required.`,
    validHostsOrHandles: $localize`Hosts or handles are invalid.`,
    unique: $localize`Hosts or handles contain duplicates.`
  }
}
