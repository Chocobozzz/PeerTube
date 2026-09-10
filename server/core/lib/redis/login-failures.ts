import { sha256 } from '@peertube/peertube-node-utils'
import { CONFIG } from '../../initializers/config.js'
import { getHash, incrementHashField, removeValue, setExpiration } from './redis-client.js'

// Failures are tracked per source IP
// Each IP's contribution to the account lock is capped at MAX_PER_IP so a single IP cannot lock an account by themselves
export async function addLoginFailure (userId: number, ip: string) {
  const key = generateLoginFailureKey(userId)
  const field = generateLoginFailureIPField(ip)

  await incrementHashField(key, field)
  await setExpiration(key, CONFIG.RATES_LIMIT.LOGIN_LOCKOUT.WINDOW_MS)

  // Let the caller know the (capped) total so it can detect the exact failure that triggers the lock
  return getLoginFailures(userId)
}

export async function getLoginFailures (userId: number) {
  const failuresPerIP = await getHash(generateLoginFailureKey(userId))

  return Object.values(failuresPerIP).reduce((total, value) => {
    return total + Math.min(parseInt(value, 10), CONFIG.RATES_LIMIT.LOGIN_LOCKOUT.MAX_PER_IP)
  }, 0)
}

export function deleteLoginFailures (userId: number) {
  return removeValue(generateLoginFailureKey(userId))
}

// ---------------------------------------------------------------------------

function generateLoginFailureKey (userId: number) {
  return 'login-failure-' + userId
}

function generateLoginFailureIPField (ip: string) {
  return sha256(CONFIG.SECRETS.PEERTUBE + '-' + ip)
}
