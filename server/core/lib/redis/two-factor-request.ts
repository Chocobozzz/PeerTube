import { generateRandomString } from '../../helpers/utils.js'
import { TWO_FACTOR_AUTH_REQUEST_TOKEN_LIFETIME } from '../../initializers/constants.js'
import { getValue, setValue } from './redis-client.js'

export async function setTwoFactorRequest (userId: number, otpSecret: string) {
  const requestToken = await generateRandomString(32)

  await setValue(generateTwoFactorRequestKey(userId, requestToken), otpSecret, TWO_FACTOR_AUTH_REQUEST_TOKEN_LIFETIME)

  return requestToken
}

export function getTwoFactorRequestToken (userId: number, requestToken: string) {
  return getValue(generateTwoFactorRequestKey(userId, requestToken))
}

// ---------------------------------------------------------------------------

function generateTwoFactorRequestKey (userId: number, token: string) {
  return 'two-factor-request-' + userId + '-' + token
}
