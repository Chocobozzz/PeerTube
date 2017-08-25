import * as validator from 'validator'

import { isArray, exists } from './misc'
import { isTestInstance } from '../core-utils'

function isHostValid (host: string) {
  const isURLOptions = {
    require_host: true,
    require_tld: true
  }

  // We validate 'localhost', so we don't have the top level domain
  if (isTestInstance()) {
    isURLOptions.require_tld = false
  }

  return exists(host) && validator.isURL(host, isURLOptions) && host.split('://').length === 1
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

declare module 'express-validator' {
  export interface Validator {
    isEachUniqueHostValid
    isHostValid
  }
}
