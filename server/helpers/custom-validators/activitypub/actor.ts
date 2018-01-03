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
    validator.isLength(publicKey, CONSTRAINTS_FIELDS.ACTORS.PUBLIC_KEY)
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
    validator.isLength(privateKey, CONSTRAINTS_FIELDS.ACTORS.PRIVATE_KEY)
}

function isActorObjectValid (actor: any) {
  return exists(actor) &&
    isActivityPubUrlValid(actor.id) &&
    isActorTypeValid(actor.type) &&
    isActivityPubUrlValid(actor.following) &&
    isActivityPubUrlValid(actor.followers) &&
    isActivityPubUrlValid(actor.inbox) &&
    isActivityPubUrlValid(actor.outbox) &&
    isActorPreferredUsernameValid(actor.preferredUsername) &&
    isActivityPubUrlValid(actor.url) &&
    isActorPublicKeyObjectValid(actor.publicKey) &&
    isActorEndpointsObjectValid(actor.endpoints) &&
    setValidAttributedTo(actor) &&
    // If this is not an account, it should be attributed to an account
    // In PeerTube we use this to attach a video channel to a specific account
    (actor.type === 'Person' || actor.attributedTo.length !== 0)
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

function isActorUpdateActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Update') &&
    isActorObjectValid(activity.object)
}

// ---------------------------------------------------------------------------

export {
  isActorEndpointsObjectValid,
  isActorPublicKeyObjectValid,
  isActorTypeValid,
  isActorPublicKeyValid,
  isActorPreferredUsernameValid,
  isActorPrivateKeyValid,
  isActorObjectValid,
  isActorFollowingCountValid,
  isActorFollowersCountValid,
  isActorFollowActivityValid,
  isActorAcceptActivityValid,
  isActorDeleteActivityValid,
  isActorUpdateActivityValid
}
