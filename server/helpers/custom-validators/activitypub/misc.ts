import validator from 'validator'
import { CONSTRAINTS_FIELDS } from '../../../initializers/constants'
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
    return (a.type === 'Group' || a.type === 'Person') && isActivityPubUrlValid(a.id)
  })

  return true
}

export {
  isUrlValid,
  isActivityPubUrlValid,
  isBaseActivityValid,
  setValidAttributedTo,
  isObjectValid
}
