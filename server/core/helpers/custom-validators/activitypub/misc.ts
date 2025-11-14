import { ActivityHtmlUrlObject } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import validator from 'validator'
import { CONSTRAINTS_FIELDS } from '../../../initializers/constants.js'
import { exists } from '../misc.js'

export function isUrlValid (url: string) {
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

export function isActivityPubUrlValid (url: string) {
  return isUrlValid(url) && validator.default.isLength('' + url, CONSTRAINTS_FIELDS.ACTORS.URL)
}

export function isBaseActivityValid (activity: any, type: string) {
  return activity.type === type &&
    isActivityPubUrlValid(activity.id) &&
    isObjectValid(activity.actor) &&
    isUrlCollectionValid(activity.to) &&
    isUrlCollectionValid(activity.cc)
}

export function isUrlCollectionValid (collection: any) {
  return collection === undefined ||
    (typeof collection === 'string' && isActivityPubUrlValid(collection)) ||
    (Array.isArray(collection) && collection.every(t => isActivityPubUrlValid(t)))
}

export function isObjectValid (object: any) {
  return exists(object) &&
    (
      isActivityPubUrlValid(object) || isActivityPubUrlValid(object.id)
    )
}

export function isActivityPubHTMLUrlValid (url: ActivityHtmlUrlObject) {
  return url?.type === 'Link' &&
    url.mediaType === 'text/html' &&
    isActivityPubUrlValid(url.href)
}

export function setValidAttributedTo (obj: any) {
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

export function isActivityPubVideoDurationValid (value: string) {
  // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-duration
  return exists(value) &&
    typeof value === 'string' &&
    value.startsWith('PT') &&
    value.endsWith('S')
}
