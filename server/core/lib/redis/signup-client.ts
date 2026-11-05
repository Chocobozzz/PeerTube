import { UserSignupClientType } from '@peertube/peertube-models'
import { SIGNUP_CLIENT_LIFETIME } from '../../initializers/constants.js'
import { getValue, setValue } from './redis-client.js'

export function setUserSignupClient (userId: number, signupClient: UserSignupClientType) {
  return setValue(generateUserSignupClientKey(userId), signupClient, SIGNUP_CLIENT_LIFETIME)
}

export async function getUserSignupClient (userId: number) {
  return await getValue(generateUserSignupClientKey(userId)) as UserSignupClientType
}

export function setRegistrationSignupClient (registrationId: number, signupClient: UserSignupClientType) {
  return setValue(generateRegistrationSignupClientKey(registrationId), signupClient, SIGNUP_CLIENT_LIFETIME)
}

export async function getRegistrationSignupClient (registrationId: number) {
  return await getValue(generateRegistrationSignupClientKey(registrationId)) as UserSignupClientType
}

// ---------------------------------------------------------------------------

function generateUserSignupClientKey (userId: number) {
  return 'signup-client-user-' + userId
}

function generateRegistrationSignupClientKey (registrationId: number) {
  return 'signup-client-registration-' + registrationId
}
