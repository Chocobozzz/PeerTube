import validator from 'validator'
import { catchErrorAsBoolean, exists, isArray } from './misc'
import { isTestInstance } from '../core-utils'
import { CONSTRAINTS_FIELDS } from '../../initializers/constants'

function checkHost (host: string) {
  const isURLOptions = {
    require_host: true,
    require_tld: true
  }

  // We validate 'localhost', so we don't have the top level domain
  if (isTestInstance()) {
    isURLOptions.require_tld = false
  }

  if (!exists(host)) throw new Error('Should have a host')
  if (!validator.isURL(host, isURLOptions)) {
    throw new Error('Should have a host with a top-level domain')
  }
  if (host.split('://').length !== 1) throw new Error('Should have a host with no protocol prefix')
  return true
}

function isEachUniqueHostValid (hosts: string[]) {
  return isArray(hosts) &&
    hosts.length !== 0 &&
    hosts.every(host => {
      return catchErrorAsBoolean(checkHost)(host) && hosts.indexOf(host) === hosts.lastIndexOf(host)
    })
}

function checkContactBody (value: any) {
  if (!exists(value)) throw new Error('Should have a contact text')
  if (!validator.isLength(value, CONSTRAINTS_FIELDS.CONTACT_FORM.BODY)) {
    const min = CONSTRAINTS_FIELDS.CONTACT_FORM.BODY.min
    const max = CONSTRAINTS_FIELDS.CONTACT_FORM.BODY.max
    throw new Error(`Should have a contact text between ${min} and ${max} characters long`)
  }
  return true
}

function checkContactFromName (value: any) {
  if (!exists(value)) throw new Error('Should have a contact From name')
  if (!validator.isLength(value, CONSTRAINTS_FIELDS.CONTACT_FORM.FROM_NAME)) {
    const min = CONSTRAINTS_FIELDS.CONTACT_FORM.FROM_NAME.min
    const max = CONSTRAINTS_FIELDS.CONTACT_FORM.FROM_NAME.max
    throw new Error(`Should have a contact From name between ${min} and ${max} characters long`)
  }
  return true
}

// ---------------------------------------------------------------------------

export {
  checkContactBody,
  checkContactFromName,
  isEachUniqueHostValid,
  checkHost
}
