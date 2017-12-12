import * as validator from 'validator'
import { CONSTRAINTS_FIELDS } from '../../../initializers'
import { isAccountNameValid } from '../accounts'
import { exists, isUUIDValid } from '../misc'
import { isActivityPubUrlValid, isBaseActivityValid } from './misc'

function isAccountEndpointsObjectValid (endpointObject: any) {
  return isActivityPubUrlValid(endpointObject.sharedInbox)
}

function isAccountPublicKeyObjectValid (publicKeyObject: any) {
  return isActivityPubUrlValid(publicKeyObject.id) &&
    isActivityPubUrlValid(publicKeyObject.owner) &&
    isAccountPublicKeyValid(publicKeyObject.publicKeyPem)
}

function isAccountTypeValid (type: string) {
  return type === 'Person' || type === 'Application'
}

function isAccountPublicKeyValid (publicKey: string) {
  return exists(publicKey) &&
    typeof publicKey === 'string' &&
    publicKey.startsWith('-----BEGIN PUBLIC KEY-----') &&
    publicKey.endsWith('-----END PUBLIC KEY-----') &&
    validator.isLength(publicKey, CONSTRAINTS_FIELDS.ACCOUNTS.PUBLIC_KEY)
}

function isAccountPreferredUsernameValid (preferredUsername: string) {
  return isAccountNameValid(preferredUsername)
}

function isAccountPrivateKeyValid (privateKey: string) {
  return exists(privateKey) &&
    typeof privateKey === 'string' &&
    privateKey.startsWith('-----BEGIN RSA PRIVATE KEY-----') &&
    privateKey.endsWith('-----END RSA PRIVATE KEY-----') &&
    validator.isLength(privateKey, CONSTRAINTS_FIELDS.ACCOUNTS.PRIVATE_KEY)
}

function isRemoteAccountValid (remoteAccount: any) {
  return isActivityPubUrlValid(remoteAccount.id) &&
    isUUIDValid(remoteAccount.uuid) &&
    isAccountTypeValid(remoteAccount.type) &&
    isActivityPubUrlValid(remoteAccount.following) &&
    isActivityPubUrlValid(remoteAccount.followers) &&
    isActivityPubUrlValid(remoteAccount.inbox) &&
    isActivityPubUrlValid(remoteAccount.outbox) &&
    isAccountPreferredUsernameValid(remoteAccount.preferredUsername) &&
    isActivityPubUrlValid(remoteAccount.url) &&
    isAccountPublicKeyObjectValid(remoteAccount.publicKey) &&
    isAccountEndpointsObjectValid(remoteAccount.endpoints)
}

function isAccountFollowingCountValid (value: string) {
  return exists(value) && validator.isInt('' + value, { min: 0 })
}

function isAccountFollowersCountValid (value: string) {
  return exists(value) && validator.isInt('' + value, { min: 0 })
}

function isAccountDeleteActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Delete')
}

function isAccountFollowActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Follow') &&
    isActivityPubUrlValid(activity.object)
}

function isAccountAcceptActivityValid (activity: any) {
  return isBaseActivityValid(activity, 'Accept')
}

// ---------------------------------------------------------------------------

export {
  isAccountEndpointsObjectValid,
  isAccountPublicKeyObjectValid,
  isAccountTypeValid,
  isAccountPublicKeyValid,
  isAccountPreferredUsernameValid,
  isAccountPrivateKeyValid,
  isRemoteAccountValid,
  isAccountFollowingCountValid,
  isAccountFollowersCountValid,
  isAccountNameValid,
  isAccountFollowActivityValid,
  isAccountAcceptActivityValid,
  isAccountDeleteActivityValid
}
