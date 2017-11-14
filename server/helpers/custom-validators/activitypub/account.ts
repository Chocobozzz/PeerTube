import * as validator from 'validator'

import { exists, isUUIDValid } from '../misc'
import { isActivityPubUrlValid } from './misc'
import { isUserUsernameValid } from '../users'
import { CONSTRAINTS_FIELDS } from '../../../initializers/constants'

function isAccountEndpointsObjectValid (endpointObject: any) {
  return isAccountSharedInboxValid(endpointObject.sharedInbox)
}

function isAccountSharedInboxValid (sharedInbox: string) {
  return isActivityPubUrlValid(sharedInbox)
}

function isAccountPublicKeyObjectValid (publicKeyObject: any) {
  return isAccountPublicKeyIdValid(publicKeyObject.id) &&
    isAccountPublicKeyOwnerValid(publicKeyObject.owner) &&
    isAccountPublicKeyValid(publicKeyObject.publicKeyPem)
}

function isAccountPublicKeyIdValid (id: string) {
  return isActivityPubUrlValid(id)
}

function isAccountTypeValid (type: string) {
  return type === 'Person' || type === 'Application'
}

function isAccountPublicKeyOwnerValid (owner: string) {
  return isActivityPubUrlValid(owner)
}

function isAccountPublicKeyValid (publicKey: string) {
  return exists(publicKey) &&
    typeof publicKey === 'string' &&
    publicKey.startsWith('-----BEGIN PUBLIC KEY-----') &&
    publicKey.endsWith('-----END PUBLIC KEY-----') &&
    validator.isLength(publicKey, CONSTRAINTS_FIELDS.ACCOUNTS.PUBLIC_KEY)
}

function isAccountIdValid (id: string) {
  return isActivityPubUrlValid(id)
}

function isAccountFollowingValid (id: string) {
  return isActivityPubUrlValid(id)
}

function isAccountFollowersValid (id: string) {
  return isActivityPubUrlValid(id)
}

function isAccountInboxValid (inbox: string) {
  return isActivityPubUrlValid(inbox)
}

function isAccountOutboxValid (outbox: string) {
  return isActivityPubUrlValid(outbox)
}

function isAccountNameValid (name: string) {
  return isUserUsernameValid(name)
}

function isAccountPreferredUsernameValid (preferredUsername: string) {
  return isAccountNameValid(preferredUsername)
}

function isAccountUrlValid (url: string) {
  return isActivityPubUrlValid(url)
}

function isAccountPrivateKeyValid (privateKey: string) {
  return exists(privateKey) &&
    typeof privateKey === 'string' &&
    privateKey.startsWith('-----BEGIN RSA PRIVATE KEY-----') &&
    privateKey.endsWith('-----END RSA PRIVATE KEY-----') &&
    validator.isLength(privateKey, CONSTRAINTS_FIELDS.ACCOUNTS.PRIVATE_KEY)
}

function isRemoteAccountValid (remoteAccount: any) {
  return isAccountIdValid(remoteAccount.id) &&
    isUUIDValid(remoteAccount.uuid) &&
    isAccountTypeValid(remoteAccount.type) &&
    isAccountFollowingValid(remoteAccount.following) &&
    isAccountFollowersValid(remoteAccount.followers) &&
    isAccountInboxValid(remoteAccount.inbox) &&
    isAccountOutboxValid(remoteAccount.outbox) &&
    isAccountPreferredUsernameValid(remoteAccount.preferredUsername) &&
    isAccountUrlValid(remoteAccount.url) &&
    isAccountPublicKeyObjectValid(remoteAccount.publicKey) &&
    isAccountEndpointsObjectValid(remoteAccount.endpoint)
}

function isAccountFollowingCountValid (value: string) {
  return exists(value) && validator.isInt('' + value, { min: 0 })
}

function isAccountFollowersCountValid (value: string) {
  return exists(value) && validator.isInt('' + value, { min: 0 })
}

// ---------------------------------------------------------------------------

export {
  isAccountEndpointsObjectValid,
  isAccountSharedInboxValid,
  isAccountPublicKeyObjectValid,
  isAccountPublicKeyIdValid,
  isAccountTypeValid,
  isAccountPublicKeyOwnerValid,
  isAccountPublicKeyValid,
  isAccountIdValid,
  isAccountFollowingValid,
  isAccountFollowersValid,
  isAccountInboxValid,
  isAccountOutboxValid,
  isAccountPreferredUsernameValid,
  isAccountUrlValid,
  isAccountPrivateKeyValid,
  isRemoteAccountValid,
  isAccountFollowingCountValid,
  isAccountFollowersCountValid,
  isAccountNameValid
}
