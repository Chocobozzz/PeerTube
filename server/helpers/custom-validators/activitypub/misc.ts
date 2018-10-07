import * as validator from 'validator'
import { CONSTRAINTS_FIELDS } from '../../../initializers'
import { isTestInstance } from '../../core-utils'
import { exists } from '../misc'

function isUrlValid (url: string) {
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

  return exists(url) && validator.isURL('' + url, isURLOptions)
}

function isActivityPubUrlValid (url: string) {
  return isUrlValid(url) && validator.isLength('' + url, CONSTRAINTS_FIELDS.ACTORS.URL)
}

function isBaseActivityValid (activity: any, type: string) {
  return (activity['@context'] === undefined || Array.isArray(activity['@context'])) &&
    activity.type === type &&
    isActivityPubUrlValid(activity.id) &&
    exists(activity.actor) &&
    (isActivityPubUrlValid(activity.actor) || isActivityPubUrlValid(activity.actor.id)) &&
    (
      activity.to === undefined ||
      (Array.isArray(activity.to) && activity.to.every(t => isActivityPubUrlValid(t)))
    ) &&
    (
      activity.cc === undefined ||
      (Array.isArray(activity.cc) && activity.cc.every(t => isActivityPubUrlValid(t)))
    )
}

function setValidAttributedTo (obj: any) {
  if (Array.isArray(obj.attributedTo) === false) {
    obj.attributedTo = []
    return true
  }

  obj.attributedTo = obj.attributedTo.filter(a => {
    return (a.type === 'Group' || a.type === 'Person') && isActivityPubUrlValid(a.id)
  })

  return true
}

export {
  isUrlValid,
  isActivityPubUrlValid,
  isBaseActivityValid,
  setValidAttributedTo
}
