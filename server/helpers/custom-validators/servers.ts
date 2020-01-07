import validator from 'validator'
import { exists, isArray } from './misc'
import { isTestInstance } from '../core-utils'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'

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

function isValidContactBody (value: any) {
  return exists(value) && validator.isLength(value, CONSTRAINTS_FIELDS.CONTACT_FORM.BODY)
}

function isValidContactFromName (value: any) {
  return exists(value) && validator.isLength(value, CONSTRAINTS_FIELDS.CONTACT_FORM.FROM_NAME)
}

// ---------------------------------------------------------------------------

export {
  isValidContactBody,
  isValidContactFromName,
  isEachUniqueHostValid,
  isHostValid
}
