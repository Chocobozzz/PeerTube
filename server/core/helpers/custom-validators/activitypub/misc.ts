import { arrayify } from '@peertube/peertube-core-utils'
import { ActivityHtmlUrlObject } from '@peertube/peertube-models'
import { peertubeTruncate } from '@peertube/peertube-node-utils'
import { createLogger } from '@server/helpers/logger.js'
import validator from 'validator'
import { ACTIVITY_PUB, CONSTRAINTS_FIELDS, MIMETYPES } from '../../../initializers/constants.js'
import { exists, isArray } from '../misc.js'
import { isUrlValid } from '../urls.js'

const logger = createLogger()

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
  obj.attributedTo = arrayify(obj.attributedTo).filter(a => {
    return isActivityPubUrlValid(a) ||
      ((a.type === 'Group' || a.type === 'Person') && isActivityPubUrlValid(a.id))
  })

  return true
}

export function setValidRemoteSupport (
  entity: { support?: string },
  constraints: { min: number, max: number }
) {
  if (!entity.support || typeof entity.support !== 'string') {
    entity.support = null
    return
  }

  entity.support = peertubeTruncate(entity.support, { length: constraints.max })

  if (entity.support.length < constraints.min) {
    entity.support = null
  }
}

export function setValidRemoteIcon (entity: any) {
  if (entity.icon && !isArray(entity.icon)) entity.icon = [ entity.icon ]
  if (!entity.icon) entity.icon = []

  // Each icon is stored as a thumbnail row, and all thumbnails are returned in the REST API
  if (entity.icon.length > ACTIVITY_PUB.MAX_ICONS) {
    logger.debug('Truncating remote icon array from %d to %d entries.', entity.icon.length, ACTIVITY_PUB.MAX_ICONS)

    entity.icon = entity.icon.slice(0, ACTIVITY_PUB.MAX_ICONS)
  }

  const existingSizes = new Set<string>()
  const dimensionOptions = { min: 0, max: ACTIVITY_PUB.MAX_ICON_DIMENSION }

  entity.icon = entity.icon.filter(icon => {
    const isValid = icon?.type === 'Image' &&
      isActivityPubUrlValid(icon.url) &&
      !!MIMETYPES.IMAGE.MIMETYPE_EXT[icon.mediaType] &&
      validator.default.isInt(icon.width + '', dimensionOptions) &&
      validator.default.isInt(icon.height + '', dimensionOptions)

    if (!isValid) return false

    // We store at most one icon per size, so ignore the next ones the remote instance may have sent
    const size = `${icon.width}x${icon.height}`
    if (existingSizes.has(size)) return false
    existingSizes.add(size)

    return true
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
