import { generateRandomString } from '../../helpers/utils.js'
import { EMAIL_VERIFY_LIFETIME } from '../../initializers/constants.js'
import { getValue, removeValue, setValue } from './redis-client.js'

export async function setUserVerifyEmailVerificationString (userId: number, isPendingEmail: boolean) {
  const generatedString = await generateRandomString(32)

  await setValue(generateUserVerifyEmailKey(userId, isPendingEmail), generatedString, EMAIL_VERIFY_LIFETIME)

  return generatedString
}

export function getUserVerifyEmailLink (userId: number, isPendingEmail: boolean) {
  return getValue(generateUserVerifyEmailKey(userId, isPendingEmail))
}

export function deleteUserVerifyEmailLink (userId: number, isPendingEmail: boolean) {
  return removeValue(generateUserVerifyEmailKey(userId, isPendingEmail))
}

export async function setRegistrationVerifyEmailVerificationString (registrationId: number) {
  const generatedString = await generateRandomString(32)

  await setValue(generateRegistrationVerifyEmailKey(registrationId), generatedString, EMAIL_VERIFY_LIFETIME)

  return generatedString
}

export function getRegistrationVerifyEmailLink (registrationId: number) {
  return getValue(generateRegistrationVerifyEmailKey(registrationId))
}

export function deleteRegistrationVerifyEmailLink (registrationId: number) {
  return removeValue(generateRegistrationVerifyEmailKey(registrationId))
}

// ---------------------------------------------------------------------------

function generateUserVerifyEmailKey (userId: number, isPendingEmail: boolean) {
  return 'verify-email-user-' + userId + (isPendingEmail ? '-pending' : '')
}

function generateRegistrationVerifyEmailKey (registrationId: number) {
  return 'verify-email-registration-' + registrationId
}
