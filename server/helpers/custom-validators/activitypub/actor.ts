import * as validator from 'validator'
import { CONSTRAINTS_FIELDS } from '../../../initializers'
import { isAccountNameValid } from '../accounts'
import { exists, isUUIDValid } from '../misc'
import { isActivityPubUrlValid, isBaseActivityValid } from './misc'

function isActorEndpointsObjectValid (endpointObject: any) {
  return isActivityPubUrlValid(endpointObject.sharedInbox)
}

function isActorPublicKeyObjectValid (publicKeyObject: any) {
  return isActivityPubUrlValid(publicKeyObject.id) &&
    isActivityPubUrlValid(publicKeyObject.owner) &&
    isActorPublicKeyValid(publicKeyObject.publicKeyPem)
}

function isActorTypeValid (type: string) {
  return type === 'Person' || type === 'Application' || type === 'Group'
}

function isActorPublicKeyValid (publicKey: string) {
  return exists(publicKey) &&
    typeof publicKey === 'string' &&
    publicKey.startsWith('-----BEGIN PUBLIC KEY-----') &&
    publicKey.endsWith('-----END PUBLIC KEY-----') &&
    validator.isLength(publicKey, CONSTRAINTS_FIELDS.ACTOR.PUBLIC_KEY)
}

function isActorPreferredUsernameValid (preferredUsername: string) {
  return isAccountNameValid(preferredUsername)
}

function isActorPrivateKeyValid (privateKey: string) {
  return exists(privateKey) &&
    typeof privateKey === 'string' &&
    privateKey.startsWith('-----BEGIN RSA PRIVATE KEY-----') &&
    privateKey.endsWith('-----END RSA PRIVATE KEY-----') &&
    validator.isLength(privateKey, CONSTRAINTS_FIELDS.ACTOR.PRIVATE_KEY)
}

function isRemoteActorValid (remoteActor: any) {
  return isActivityPubUrlValid(remoteActor.id) &&
    isUUIDValid(remoteActor.uuid) &&
    isActorTypeValid(remoteActor.type) &&
    isActivityPubUrlValid(remoteActor.following) &&
    isActivityPubUrlValid(remoteActor.followers) &&
    isActivityPubUrlValid(remoteActor.inbox) &&
    isActivityPubUrlValid(remoteActor.outbox) &&
    isActorPreferredUsernameValid(remoteActor.preferredUsername) &&
    isActivityPubUrlValid(remoteActor.url) &&
    isActorPublicKeyObjectValid(remoteActor.publicKey) &&
    isActorEndpointsObjectValid(remoteActor.endpoints)
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

function isActorFollowActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Follow') &&
    isActivityPubUrlValid(activity.object)
}

function isActorAcceptActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Accept')
}

// ---------------------------------------------------------------------------

export {
  isActorEndpointsObjectValid,
  isActorPublicKeyObjectValid,
  isActorTypeValid,
  isActorPublicKeyValid,
  isActorPreferredUsernameValid,
  isActorPrivateKeyValid,
  isRemoteActorValid,
  isActorFollowingCountValid,
  isActorFollowersCountValid,
  isActorFollowActivityValid,
  isActorAcceptActivityValid,
  isActorDeleteActivityValid
}
