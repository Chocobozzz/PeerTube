import validator from 'validator'
import { CONFIG } from '@server/initializers/config.js'
import { CONSTRAINTS_FIELDS } from '../../../initializers/constants.js'
import { exists } from '../misc.js'

function isUrlValid (url: string) {
  const isURLOptions = {
    require_host: true,
    require_tld: true,
    require_protocol: true,
    require_valid_protocol: true,
    protocols: [ 'http', 'https' ]
  }

  // We validate 'localhost', so we don't have the top level domain
  if (CONFIG.WEBSERVER.HOSTNAME === 'localhost' || CONFIG.WEBSERVER.HOSTNAME === '127.0.0.1') {
    isURLOptions.require_tld = false
  }

  return exists(url) && validator.default.isURL('' + url, isURLOptions)
}

function isActivityPubUrlValid (url: string) {
  return isUrlValid(url) && validator.default.isLength('' + url, CONSTRAINTS_FIELDS.ACTORS.URL)
}

function isBaseActivityValid (activity: any, type: string) {
  return activity.type === type &&
    isActivityPubUrlValid(activity.id) &&
    isObjectValid(activity.actor) &&
    isUrlCollectionValid(activity.to) &&
    isUrlCollectionValid(activity.cc)
}

function isUrlCollectionValid (collection: any) {
  return collection === undefined ||
    (Array.isArray(collection) && collection.every(t => isActivityPubUrlValid(t)))
}

function isObjectValid (object: any) {
  return exists(object) &&
    (
      isActivityPubUrlValid(object) || isActivityPubUrlValid(object.id)
    )
}

function setValidAttributedTo (obj: any) {
  if (Array.isArray(obj.attributedTo) === false) {
    obj.attributedTo = []
    return true
  }

  obj.attributedTo = obj.attributedTo.filter(a => {
    return isActivityPubUrlValid(a) ||
      ((a.type === 'Group' || a.type === 'Person') && isActivityPubUrlValid(a.id))
  })

  return true
}

function isActivityPubVideoDurationValid (value: string) {
  // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-duration
  return exists(value) &&
    typeof value === 'string' &&
    value.startsWith('PT') &&
    value.endsWith('S')
}

export {
  isUrlValid,
  isActivityPubUrlValid,
  isBaseActivityValid,
  setValidAttributedTo,
  isObjectValid,
  isActivityPubVideoDurationValid
}
