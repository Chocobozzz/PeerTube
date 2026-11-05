import { timeoutPromise } from '@peertube/peertube-core-utils'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { DATABASE_READ_REPLICAS } from '@server/initializers/constants.js'
import { Redis } from '@server/lib/redis/redis.js'
import { DbContext, getDbContext } from '../db-context.js'

/**
 * Read-your-writes: after a write, reads of the user use the primary for a specific duration to prevent miss on replication lag
 */

const logger = createLogger('database-replicas')

// Record request writes in Redis at most once per interval
const CONTEXT_RECORD_INTERVAL_MS = 1000

// Must be called after the commit of the write, and before answering the request
export async function recordContextWrite () {
  const context = getDbContext()
  if (!context) return

  // Next reads of this context must also see this write, even for anonymous users
  context.usePrimary = Promise.resolve(true)

  if (!context.userId) return

  const now = Date.now()

  if (!context.lastUserWriteRecord || now - context.lastUserWriteRecord.at >= CONTEXT_RECORD_INTERVAL_MS) {
    context.lastUserWriteRecord = { at: now, promise: recordUserWrite(context.userId, CONTEXT_RECORD_INTERVAL_MS) }
  }

  // Concurrent writes of the context wait for the same record
  await context.lastUserWriteRecord.promise
}

export async function recordUserWrite (userId: number, extraDurationMs = 0) {
  try {
    await timeoutPromise(
      Redis.Instance.setUserRecentDbWrite(userId, getRecentWriteDuration() + extraDurationMs),
      DATABASE_READ_REPLICAS.REDIS_TIMEOUT_MS
    )
  } catch (err) {
    logger.warn('Cannot record database write of user ' + userId, { err })
  }
}

export function shouldContextUsePrimary (context: DbContext) {
  // Lazy load usePrimary, based on the user from the context
  if (context.usePrimary === undefined) {
    context.usePrimary = context.userId
      ? (timeoutPromise(Redis.Instance.hasUserRecentDbWrite(context.userId), DATABASE_READ_REPLICAS.REDIS_TIMEOUT_MS) as Promise<boolean>)
        .catch(err => {
          logger.debug('Cannot know if the user wrote recently in the database, use primary.', { err })
          return true
        })
      : Promise.resolve(false)
  }

  return context.usePrimary
}

// ---------------------------------------------------------------------------

function getRecentWriteDuration () {
  return CONFIG.DATABASE.READ_REPLICAS.MAX_LAG + 1000
}
