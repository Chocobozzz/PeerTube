import { PLUGIN_EXTERNAL_AUTH_TOKEN_LIFETIME } from '../../initializers/constants.js'
import { getAndDeleteValue, setValue } from './redis-client.js'

/**
 * One-time tokens generated when an external auth plugin authenticated a user
 * This token is exchanged for an OAuth token by the login request that follows
 */

// Only a garbage collection delay: we check the expiration stored in the payload
const EXPIRATION_MARGIN_MS = 1000 * 60

export function setExternalAuthToken (token: string, payload: object) {
  return setValue(
    generateExternalAuthTokenKey(token),
    JSON.stringify(payload),
    PLUGIN_EXTERNAL_AUTH_TOKEN_LIFETIME + EXPIRATION_MARGIN_MS
  )
}

export async function consumeExternalAuthToken<T> (token: string): Promise<T> {
  // Consumed atomically: two processes receiving the same token cannot both log the user in
  const value = await getAndDeleteValue(generateExternalAuthTokenKey(token))
  if (!value) return undefined

  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------

function generateExternalAuthTokenKey (token: string) {
  return 'external-auth-token-' + token
}
