import { exists } from '../misc'

function isActivityPubUrlValid (url: string) {
  const isURLOptions = {
    require_host: true,
    require_tld: true,
    require_protocol: true,
    require_valid_protocol: true,
    protocols: [ 'http', 'https' ]
  }

  return exists(url) && validator.isURL(url, isURLOptions)
}

function isBaseActivityValid (activity: any, type: string) {
  return Array.isArray(activity['@context']) &&
    activity.type === type &&
    validator.isURL(activity.id) &&
    validator.isURL(activity.actor) &&
    Array.isArray(activity.to) &&
    activity.to.every(t => validator.isURL(t))
}

export {
  isActivityPubUrlValid,
  isBaseActivityValid
}
