import * as validator from 'validator'
import { exists } from '../misc'
import { isTestInstance } from '../../core-utils'
import { CONSTRAINTS_FIELDS } from '../../../initializers/constants'

function isActivityPubUrlValid (url: string) {
  const isURLOptions = {
    require_host: true,
    require_tld: true,
    require_protocol: true,
    require_valid_protocol: true,
    protocols: [ 'http', 'https' ]
  }

  // We validate 'localhost', so we don't have the top level domain
  if (isTestInstance()) {
    isURLOptions.require_tld = false
  }

  return exists(url) && validator.isURL(url, isURLOptions) && validator.isLength(url, CONSTRAINTS_FIELDS.ACCOUNTS.URL)
}

function isBaseActivityValid (activity: any, type: string) {
  return Array.isArray(activity['@context']) &&
    activity.type === type &&
    isActivityPubUrlValid(activity.id) &&
    isActivityPubUrlValid(activity.actor) &&
    (
      activity.to === undefined ||
      (Array.isArray(activity.to) && activity.to.every(t => isActivityPubUrlValid(t)))
    )
}

export {
  isActivityPubUrlValid,
  isBaseActivityValid
}
