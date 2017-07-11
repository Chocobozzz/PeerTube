import * as validator from 'validator'

import { isArray, exists } from './misc'

function isHostValid (host: string) {
  return exists(host) && validator.isURL(host) && host.split('://').length === 1
}

function isEachUniqueHostValid (hosts: string[]) {
  return isArray(hosts) &&
    hosts.length !== 0 &&
    hosts.every(host => {
      return isHostValid(host) && hosts.indexOf(host) === hosts.lastIndexOf(host)
    })
}

// ---------------------------------------------------------------------------

export {
  isEachUniqueHostValid,
  isHostValid
}

declare global {
  namespace ExpressValidator {
    export interface Validator {
      isEachUniqueHostValid
      isHostValid
    }
  }
}
