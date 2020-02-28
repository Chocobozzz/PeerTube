import validator from 'validator'
import { CONSTRAINTS_FIELDS } from '../../../initializers/constants'
import { exists, isArray } from '../misc'
import { isActivityPubUrlValid, isBaseActivityValid, setValidAttributedTo } from './misc'
import { isHostValid } from '../servers'
import { peertubeTruncate } from '@server/helpers/core-utils'

function isActorEndpointsObjectValid (endpointObject: any) {
  if (endpointObject?.sharedInbox) {
    return isActivityPubUrlValid(endpointObject.sharedInbox)
  }

  // Shared inbox is optional
  return true
}

function isActorPublicKeyObjectValid (publicKeyObject: any) {
  return isActivityPubUrlValid(publicKeyObject.id) &&
    isActivityPubUrlValid(publicKeyObject.owner) &&
    isActorPublicKeyValid(publicKeyObject.publicKeyPem)
}

function isActorTypeValid (type: string) {
  return type === 'Person' || type === 'Application' || type === 'Group' || type === 'Service' || type === 'Organization'
}

function isActorPublicKeyValid (publicKey: string) {
  return exists(publicKey) &&
    typeof publicKey === 'string' &&
    publicKey.startsWith('-----BEGIN PUBLIC KEY-----') &&
    publicKey.includes('-----END PUBLIC KEY-----') &&
    validator.isLength(publicKey, CONSTRAINTS_FIELDS.ACTORS.PUBLIC_KEY)
}

const actorNameAlphabet = '[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\\-_.:]'
const actorNameRegExp = new RegExp(`^${actorNameAlphabet}+$`)
function isActorPreferredUsernameValid (preferredUsername: string) {
  return exists(preferredUsername) && validator.matches(preferredUsername, actorNameRegExp)
}

function isActorPrivateKeyValid (privateKey: string) {
  return exists(privateKey) &&
    typeof privateKey === 'string' &&
    privateKey.startsWith('-----BEGIN RSA PRIVATE KEY-----') &&
    // Sometimes there is a \n at the end, so just assert the string contains the end mark
    privateKey.includes('-----END RSA PRIVATE KEY-----') &&
    validator.isLength(privateKey, CONSTRAINTS_FIELDS.ACTORS.PRIVATE_KEY)
}

function isActorObjectValid (actor: any) {
  return exists(actor) &&
    isActivityPubUrlValid(actor.id) &&
    isActorTypeValid(actor.type) &&
    isActivityPubUrlValid(actor.inbox) &&
    isActorPreferredUsernameValid(actor.preferredUsername) &&
    isActivityPubUrlValid(actor.url) &&
    isActorPublicKeyObjectValid(actor.publicKey) &&
    isActorEndpointsObjectValid(actor.endpoints) &&

    (!actor.outbox || isActivityPubUrlValid(actor.outbox)) &&
    (!actor.following || isActivityPubUrlValid(actor.following)) &&
    (!actor.followers || isActivityPubUrlValid(actor.followers)) &&

    setValidAttributedTo(actor) &&
    // If this is a group (a channel), it should be attributed to an account
    // In PeerTube we use this to attach a video channel to a specific account
    (actor.type !== 'Group' || actor.attributedTo.length !== 0)
}

function isActorFollowingCountValid (value: string) {
  return exists(value) && validator.isInt('' + value, { min: 0 })
}

function isActorFollowersCountValid (value: string) {
  return exists(value) && validator.isInt('' + value, { min: 0 })
}

function isActorDeleteActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Delete')
}

function sanitizeAndCheckActorObject (object: any) {
  normalizeActor(object)

  return isActorObjectValid(object)
}

function normalizeActor (actor: any) {
  if (!actor) return

  if (!actor.url) {
    actor.url = actor.id
  } else if (typeof actor.url !== 'string') {
    actor.url = actor.url.href || actor.url.url
  }

  if (actor.summary && typeof actor.summary === 'string') {
    actor.summary = peertubeTruncate(actor.summary, { length: CONSTRAINTS_FIELDS.USERS.DESCRIPTION.max })

    if (actor.summary.length < CONSTRAINTS_FIELDS.USERS.DESCRIPTION.min) {
      actor.summary = null
    }
  }
}

function isValidActorHandle (handle: string) {
  if (!exists(handle)) return false

  const parts = handle.split('@')
  if (parts.length !== 2) return false

  return isHostValid(parts[1])
}

function areValidActorHandles (handles: string[]) {
  return isArray(handles) && handles.every(h => isValidActorHandle(h))
}

// ---------------------------------------------------------------------------

export {
  normalizeActor,
  actorNameAlphabet,
  areValidActorHandles,
  isActorEndpointsObjectValid,
  isActorPublicKeyObjectValid,
  isActorTypeValid,
  isActorPublicKeyValid,
  isActorPreferredUsernameValid,
  isActorPrivateKeyValid,
  isActorObjectValid,
  isActorFollowingCountValid,
  isActorFollowersCountValid,
  isActorDeleteActivityValid,
  sanitizeAndCheckActorObject,
  isValidActorHandle
}
