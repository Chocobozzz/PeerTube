import { generateRandomString } from '../../helpers/utils.js'
import { USER_PASSWORD_CREATE_LIFETIME, USER_PASSWORD_RESET_LIFETIME } from '../../initializers/constants.js'
import { getValue, removeValue, setValue } from './redis-client.js'

export async function setResetPasswordVerificationString (userId: number) {
  const generatedString = await generateRandomString(32)

  await setValue(generateResetPasswordKey(userId), generatedString, USER_PASSWORD_RESET_LIFETIME)

  return generatedString
}

export async function setCreatePasswordVerificationString (userId: number) {
  const generatedString = await generateRandomString(32)

  await setValue(generateResetPasswordKey(userId), generatedString, USER_PASSWORD_CREATE_LIFETIME)

  return generatedString
}

export function removePasswordVerificationString (userId: number) {
  return removeValue(generateResetPasswordKey(userId))
}

export function getResetPasswordVerificationString (userId: number) {
  return getValue(generateResetPasswordKey(userId))
}

// ---------------------------------------------------------------------------

function generateResetPasswordKey (userId: number) {
  return 'reset-password-' + userId
}
