import { Injectable } from '@angular/core'
import { ValidatorFn, Validators } from '@angular/forms'
import { BuildFormValidator } from './form-validator.service'
import { validateHost } from './host'

@Injectable()
export class BatchDomainsValidatorsService {
  readonly DOMAINS: BuildFormValidator

  constructor () {
    this.DOMAINS = {
      VALIDATORS: [ Validators.required, this.validDomains, this.isHostsUnique ],
      MESSAGES: {
        'required': $localize`Domain is required.`,
        'validDomains': $localize`Domains entered are invalid.`,
        'uniqueDomains': $localize`Domains entered contain duplicates.`
      }
    }
  }

  getNotEmptyHosts (hosts: string) {
    return hosts
      .split('\n')
      .filter((host: string) => host && host.length !== 0) // Eject empty hosts
  }

  private validDomains: ValidatorFn = (control) => {
    if (!control.value) return null

    const newHostsErrors = []
    const hosts = this.getNotEmptyHosts(control.value)

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

  private isHostsUnique: ValidatorFn = (control) => {
    if (!control.value) return null

    const hosts = this.getNotEmptyHosts(control.value)

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
}
