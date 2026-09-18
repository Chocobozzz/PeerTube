import { wait } from '@peertube/peertube-core-utils'
import { buildUUID } from '@peertube/peertube-node-utils'
import { createLogger } from '@server/helpers/logger.js'
import { Redis } from './redis/index.js'

const logger = createLogger('distributed-lock')

// The lock expires if its holder crashed, so it is not held forever
// A living holder extends it periodically, so its operation can take longer
const LOCK_TTL_MS = 30000
const LOCK_EXTEND_INTERVAL_MS = LOCK_TTL_MS / 3

// Every waiter polls Redis, keep the delay short so the lock is quickly handed over
const MIN_RETRY_DELAY_MS = 50
const MAX_RETRY_DELAY_MS = 250

/**
 * Lock shared by all the PeerTube processes of the platform, using Redis
 *
 * Returns a releaser that can safely be called multiple times, resolved when the lock is released
 */
export async function acquireDistributedLock (lockKey: string): Promise<() => Promise<void>> {
  const token = buildUUID()

  let retryDelay = MIN_RETRY_DELAY_MS

  while (!await Redis.Instance.tryAcquireLock(lockKey, token, LOCK_TTL_MS)) {
    await wait(retryDelay)

    retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS)
  }

  logger.debug(`Acquired distributed lock ${lockKey}.`)

  const interval = setInterval(() => {
    Redis.Instance.extendLock(lockKey, token, LOCK_TTL_MS)
      .then(extended => {
        if (!extended) logger.error(`Distributed lock ${lockKey} expired before its release: another process may have acquired it.`)
      })
      .catch(err => logger.error(`Cannot extend distributed lock ${lockKey}.`, { err }))
  }, LOCK_EXTEND_INTERVAL_MS)

  let releasing: Promise<void>

  return () => {
    if (releasing !== undefined) return releasing

    clearInterval(interval)

    releasing = Redis.Instance.releaseLock(lockKey, token)
      .then(() => logger.debug(`Released distributed lock ${lockKey}.`))
      .catch(err => logger.error(`Cannot release distributed lock ${lockKey}, it will expire in ${LOCK_TTL_MS}ms.`, { err }))

    return releasing
  }
}
