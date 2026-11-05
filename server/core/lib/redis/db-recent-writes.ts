import { getValue, setValue } from './redis-client.js'

export function setUserRecentDbWrite (userId: number, ttlMs: number) {
  return setValue(generateKey(userId), '1', ttlMs)
}

export async function hasUserRecentDbWrite (userId: number) {
  return await getValue(generateKey(userId)) !== null
}

// ---------------------------------------------------------------------------

function generateKey (userId: number) {
  return 'db-recent-write-user-' + userId
}
