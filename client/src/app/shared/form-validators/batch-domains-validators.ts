import { AbstractControl, FormControl, ValidatorFn, Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.model'
import { validateHost } from './host'

export function getNotEmptyHosts (hosts: string) {
  return hosts
    .split('\n')
    .filter((host: string) => host && host.length !== 0) // Eject empty hosts
}

const validDomains: ValidatorFn = (control: FormControl) => {
  if (!control.value) return null

  const newHostsErrors = []
  const hosts = getNotEmptyHosts(control.value)

  for (const host of hosts) {
    if (validateHost(host) === false) {
      newHostsErrors.push($localize`${host} is not valid`)
    }
  }

  /* Is not valid. */
  if (newHostsErrors.length !== 0) {
    return {
      'validDomains': {
        reason: 'invalid',
        value: newHostsErrors.join('. ') + '.'
      }
    }
  }

  /* Is valid. */
  return null
}

const isHostsUnique: ValidatorFn = (control: AbstractControl) => {
  if (!control.value) return null

  const hosts = getNotEmptyHosts(control.value)

  if (hosts.every((host: string) => hosts.indexOf(host) === hosts.lastIndexOf(host))) {
    return null
  } else {
    return {
      'uniqueDomains': {
        reason: 'invalid'
      }
    }
  }
}

export const DOMAINS_VALIDATOR: BuildFormValidator = {
  VALIDATORS: [Validators.required, validDomains, isHostsUnique],
  MESSAGES: {
    'required': $localize`Domain is required.`,
    'validDomains': $localize`Domains entered are invalid.`,
    'uniqueDomains': $localize`Domains entered contain duplicates.`
  }
}
