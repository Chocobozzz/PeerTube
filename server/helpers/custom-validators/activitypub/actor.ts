import * as validator from 'validator'
import { CONSTRAINTS_FIELDS } from '../../../initializers'
import { isAccountNameValid } from '../accounts'
import { exists } from '../misc'
import { isVideoChannelNameValid } from '../video-channels'
import { isActivityPubUrlValid, isBaseActivityValid, setValidAttributedTo } from './misc'

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
    publicKey.indexOf('-----END PUBLIC KEY-----') !== -1 &&
    validator.isLength(publicKey, CONSTRAINTS_FIELDS.ACTOR.PUBLIC_KEY)
}

const actorNameRegExp = new RegExp('[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_]+')
function isActorPreferredUsernameValid (preferredUsername: string) {
  return exists(preferredUsername) && validator.matches(preferredUsername, actorNameRegExp)
}

function isActorNameValid (name: string) {
  return isAccountNameValid(name) || isVideoChannelNameValid(name)
}

function isActorPrivateKeyValid (privateKey: string) {
  return exists(privateKey) &&
    typeof privateKey === 'string' &&
    privateKey.startsWith('-----BEGIN RSA PRIVATE KEY-----') &&
    // Sometimes there is a \n at the end, so just assert the string contains the end mark
    privateKey.indexOf('-----END RSA PRIVATE KEY-----') !== -1 &&
    validator.isLength(privateKey, CONSTRAINTS_FIELDS.ACTOR.PRIVATE_KEY)
}

function isRemoteActorValid (remoteActor: any) {
  return exists(remoteActor) &&
    isActivityPubUrlValid(remoteActor.id) &&
    isActorTypeValid(remoteActor.type) &&
    isActivityPubUrlValid(remoteActor.following) &&
    isActivityPubUrlValid(remoteActor.followers) &&
    isActivityPubUrlValid(remoteActor.inbox) &&
    isActivityPubUrlValid(remoteActor.outbox) &&
    isActorPreferredUsernameValid(remoteActor.preferredUsername) &&
    isActivityPubUrlValid(remoteActor.url) &&
    isActorPublicKeyObjectValid(remoteActor.publicKey) &&
    isActorEndpointsObjectValid(remoteActor.endpoints) &&
    setValidAttributedTo(remoteActor) &&
    // If this is not an account, it should be attributed to an account
    // In PeerTube we use this to attach a video channel to a specific account
    (remoteActor.type === 'Person' || remoteActor.attributedTo.length !== 0)
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
  isActorDeleteActivityValid,
  isActorNameValid
}
