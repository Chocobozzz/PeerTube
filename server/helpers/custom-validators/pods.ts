import expressValidator = require('express-validator')
// TODO: use .validator when express-validator typing will have validator field
const validator = expressValidator['validator']

import { isArray } from './misc'

function isHostValid (host) {
  return validator.isURL(host) && host.split('://').length === 1
}

function isEachUniqueHostValid (hosts) {
  return isArray(hosts) &&
    hosts.length !== 0 &&
    hosts.every(function (host) {
      return isHostValid(host) && hosts.indexOf(host) === hosts.lastIndexOf(host)
    })
}

// ---------------------------------------------------------------------------

export {
  isEachUniqueHostValid,
  isHostValid
}
