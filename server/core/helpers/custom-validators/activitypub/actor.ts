import { unarray } from '@peertube/peertube-core-utils'
import { peertubeTruncate } from '@server/helpers/core-utils.js'
import validator from 'validator'
import { CONSTRAINTS_FIELDS } from '../../../initializers/constants.js'
import { exists, isArray, isDateValid } from '../misc.js'
import { isHostValid } from '../servers.js'
import { isActivityPubUrlValid, isBaseActivityValid, setValidAttributedTo } from './misc.js'

export function isActorEndpointsObjectValid (endpointObject: any) {
  if (endpointObject?.sharedInbox) {
    return isActivityPubUrlValid(endpointObject.sharedInbox)
  }

  // Shared inbox is optional
  return true
}

export function isActorPublicKeyObjectValid (publicKeyObject: any) {
  return isActivityPubUrlValid(publicKeyObject.id) &&
    isActivityPubUrlValid(publicKeyObject.owner) &&
    isActorPublicKeyValid(publicKeyObject.publicKeyPem)
}

const actorTypes = new Set([ 'Person', 'Application', 'Group', 'Service', 'Organization' ])
export function isActorTypeValid (type: string) {
  return actorTypes.has(type)
}

export function isActorPublicKeyValid (publicKey: string) {
  return exists(publicKey) &&
    typeof publicKey === 'string' &&
    publicKey.startsWith('-----BEGIN PUBLIC KEY-----') &&
    publicKey.includes('-----END PUBLIC KEY-----') &&
    validator.default.isLength(publicKey, CONSTRAINTS_FIELDS.ACTORS.PUBLIC_KEY)
}

export const actorNameAlphabet = '[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\\-_.:]'

const actorNameRegExp = new RegExp(`^${actorNameAlphabet}+$`)
export function isActorPreferredUsernameValid (preferredUsername: string) {
  return exists(preferredUsername) && validator.default.matches(preferredUsername, actorNameRegExp)
}

export function isActorPrivateKeyValid (privateKey: string) {
  return exists(privateKey) &&
    typeof privateKey === 'string' &&
    (privateKey.startsWith('-----BEGIN RSA PRIVATE KEY-----') || privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) &&
    // Sometimes there is a \n at the end, so just assert the string contains the end mark
    (privateKey.includes('-----END RSA PRIVATE KEY-----') || privateKey.includes('-----END PRIVATE KEY-----')) &&
    validator.default.isLength(privateKey, CONSTRAINTS_FIELDS.ACTORS.PRIVATE_KEY)
}

export function isActorFollowingCountValid (value: string) {
  return exists(value) && validator.default.isInt('' + value, { min: 0 })
}

export function isActorFollowersCountValid (value: string) {
  return exists(value) && validator.default.isInt('' + value, { min: 0 })
}

export function isActorDeleteActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Delete')
}

export function sanitizeAndCheckActorObject (actor: any) {
  if (!isActorTypeValid(actor.type)) return false

  normalizeActor(actor)

  return exists(actor) &&
    isActivityPubUrlValid(actor.id) &&
    isActivityPubUrlValid(actor.inbox) &&
    isActorPreferredUsernameValid(actor.preferredUsername) &&
    isActivityPubUrlValid(actor.url) &&
    isActorPublicKeyObjectValid(actor.publicKey) &&
    isActorEndpointsObjectValid(actor.endpoints) &&

    (!actor.outbox || isActivityPubUrlValid(actor.outbox)) &&
    (!actor.following || isActivityPubUrlValid(actor.following)) &&
    (!actor.followers || isActivityPubUrlValid(actor.followers)) &&

    setValidAttributedTo(actor) &&
    setValidDescription(actor) &&
    // If this is a group (a channel), it should be attributed to an account
    // In PeerTube we use this to attach a video channel to a specific account
    (actor.type !== 'Group' || actor.attributedTo.length !== 0)
}

export function normalizeActor (actor: any) {
  if (!actor) return

  if (!actor.url) {
    actor.url = actor.id
  } else if (isArray(actor.url)) {
    actor.url = unarray(actor.url)
  } else if (typeof actor.url !== 'string') {
    actor.url = actor.url.href || actor.url.url
  }

  if (!isDateValid(actor.published)) actor.published = undefined

  if (actor.summary && typeof actor.summary === 'string') {
    actor.summary = peertubeTruncate(actor.summary, { length: CONSTRAINTS_FIELDS.USERS.DESCRIPTION.max })

    if (actor.summary.length < CONSTRAINTS_FIELDS.USERS.DESCRIPTION.min) {
      actor.summary = null
    }
  }
}

export function isValidActorHandle (handle: string) {
  if (!exists(handle)) return false

  const parts = handle.split('@')
  if (parts.length !== 2) return false

  return isHostValid(parts[1])
}

export function areValidActorHandles (handles: string[]) {
  return isArray(handles) && handles.every(h => isValidActorHandle(h))
}

export function setValidDescription (obj: any) {
  if (!obj.summary) obj.summary = null

  return true
}
