import { runExtendLock, runReleaseLock, setValueIfNotExists } from './redis-client.js'

/**
 * Locks shared by all the processes of the platform
 */

export function tryAcquireLock (lockKey: string, token: string, ttlMs: number) {
  return setValueIfNotExists(buildKey(lockKey), token, ttlMs)
}

export async function extendLock (lockKey: string, token: string, ttlMs: number) {
  return await runExtendLock({ lockKey: buildKey(lockKey), token, ttlMs }) === 1
}

export async function releaseLock (lockKey: string, token: string) {
  return await runReleaseLock({ lockKey: buildKey(lockKey), token }) === 1
}

// ---------------------------------------------------------------------------

function buildKey (lockKey: string) {
  return 'lock-' + lockKey
}
