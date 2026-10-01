import { AsyncLocalStorage } from 'node:async_hooks'
import { acquireDistributedLock } from '../distributed-lock.js'

/**
 * Serializes across all the PeerTube processes the writes of the same remote object
 */

const LOCK_TIMEOUT_MS = 10 * 60 * 1000

type HeldLock = {
  key: string
  released: boolean
  parent: HeldLock
}

const heldLocks = new AsyncLocalStorage<HeldLock>()

export async function runWithAPObjectLock<T> (key: string, fn: () => Promise<T>): Promise<T> {
  if (isLockHeld(key)) return fn()

  const release = await acquireDistributedLock('ap-object-' + key, { timeoutMs: LOCK_TIMEOUT_MS })
  const held: HeldLock = { key, released: false, parent: heldLocks.getStore() }

  try {
    return await heldLocks.run(held, fn)
  } finally {
    held.released = true

    await release()
  }
}

export function buildAPFollowLockKey (followerUrl: string, followingUrl: string) {
  return 'follow-' + followerUrl + '-' + followingUrl
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function isLockHeld (key: string) {
  let held = heldLocks.getStore()

  while (held) {
    if (held.key === key && !held.released) return true

    held = held.parent
  }

  return false
}
