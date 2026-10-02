import { createLogger } from '@server/helpers/logger.js'
import { ClientRateLimitInfo, Options as RateLimitHandlerOptions, Store } from 'express-rate-limit'
import { LRUCache } from 'lru-cache'
import { Redis } from './redis.js'

const logger = createLogger('rate-limit')

// Redis can fail while being connected (OOM, READONLY replica...): don't retry and log on every request
const SYNC_ERROR_BACKOFF_MS = 5000

type LocalCounter = {
  totalHits: number
  resetTime: number

  unsyncedHits: number

  syncing: Promise<void>

  // Don't sync the hits with Redis if the key is reset
  reset: boolean
}

/**
 * Rate limit counters shared by every PeerTube process using Redis
 *
 * Cache the hits locally, and sync them with Redis in the background, so other processes may exceed the rate limit
 */
export class SharedRateLimitStore implements Store {
  // Counters are shared with other processes
  readonly localKeys = false
  readonly prefix: string

  private windowMs: number

  private lastSyncError = 0 // Date.getTime()

  private readonly counters = new LRUCache<string, LocalCounter>({ max: 100_000 })

  constructor (private readonly options: {
    // Namespace of the counters in Redis, must be unique per limiter
    name: string

    //  Force to wait for Redis to enforce the limit.
    strict?: boolean // default: false
  }) {
    this.prefix = options.name + '-'

    Redis.Instance.onConnect(() => {
      this.lastSyncError = 0

      this.syncAllInBackground()
    })
  }

  init (options: RateLimitHandlerOptions) {
    this.windowMs = options.windowMs
  }

  async get (key: string): Promise<ClientRateLimitInfo> {
    if (this.options.strict !== true) {
      // The LRU TTL expires the counter with its window
      const counter = this.counters.get(key)

      if (counter) {
        return { totalHits: counter.totalHits, resetTime: new Date(counter.resetTime) }
      }
    }

    // Fetch from Redis
    try {
      const result = await Redis.Instance.getRateLimit(this.prefix + key)
      if (!result) return undefined

      return { totalHits: result.totalHits, resetTime: new Date(Date.now() + result.msBeforeReset) }
    } catch (err) {
      logger.warn('Cannot read rate limit counter from Redis.', { err })

      return undefined
    }
  }

  async increment (key: string): Promise<ClientRateLimitInfo> {
    // Bypass local cache
    if (this.options.strict === true) {
      try {
        const { totalHits, msBeforeReset } = await this.incrementInRedis(key, 1)

        return { totalHits, resetTime: new Date(Date.now() + msBeforeReset) }
      } catch (err) {
        logger.error('Cannot increment rate limit counter in Redis, rejecting the request.', { err })

        // resetTime is undefined so express-rate-limit rejects the request
        return { totalHits: Number.MAX_SAFE_INTEGER, resetTime: undefined }
      }
    }

    const counter = this.getOrCreateLocalCounter(key)
    counter.totalHits++
    counter.unsyncedHits++

    this.syncInBackground(key, counter)

    return { totalHits: counter.totalHits, resetTime: new Date(counter.resetTime) }
  }

  async decrement (key: string) {
    const counter = this.options.strict === true
      ? undefined
      : this.counters.get(key)

    // Redis sync
    if (!counter) {
      try {
        await this.incrementInRedis(key, -1)
      } catch (err) {
        logger.warn('Cannot decrement rate limit counter in Redis.', { err })
      }

      return
    }

    counter.totalHits--
    counter.unsyncedHits--

    this.syncInBackground(key, counter)
  }

  async resetKey (key: string) {
    const counter = this.counters.get(key)
    this.counters.delete(key)

    if (counter) {
      counter.reset = true

      // Wait for pending syncing
      await counter.syncing
    }

    try {
      await Redis.Instance.resetRateLimit(this.prefix + key)
    } catch (err) {
      logger.warn('Cannot reset rate limit counter in Redis.', { err })
    }
  }

  // ---------------------------------------------------------------------------

  private incrementInRedis (key: string, hits: number) {
    return Redis.Instance.incrementRateLimit({ key: this.prefix + key, hits, windowMs: this.windowMs })
  }

  private getOrCreateLocalCounter (key: string) {
    const existing = this.counters.get(key)
    if (existing) return existing

    const counter: LocalCounter = {
      totalHits: 0,
      resetTime: Date.now() + this.windowMs,
      unsyncedHits: 0,
      syncing: undefined,
      reset: false
    }
    this.counters.set(key, counter, { ttl: this.windowMs })

    return counter
  }

  private syncAllInBackground () {
    for (const [ key, counter ] of this.counters.entries()) {
      this.syncInBackground(key, counter)
    }
  }

  private syncInBackground (key: string, counter: LocalCounter) {
    if (counter.syncing !== undefined) return
    if (!this.mustSync(counter)) return

    counter.syncing = this.sync(key, counter)
  }

  private mustSync (counter: LocalCounter) {
    return counter.unsyncedHits !== 0 &&
      counter.reset !== true &&
      Redis.Instance.isConnected() &&
      Date.now() - this.lastSyncError >= SYNC_ERROR_BACKOFF_MS
  }

  private async sync (key: string, counter: LocalCounter) {
    try {
      do {
        const hits = counter.unsyncedHits
        counter.unsyncedHits = 0

        let result: { totalHits: number, msBeforeReset: number }

        try {
          result = await this.incrementInRedis(key, hits)
        } catch (err) {
          this.onSyncError(err)

          // Reset the counter since we could increment REdis
          counter.unsyncedHits += hits
          return
        }

        // We may have received unsyncedHits during Redis clall
        counter.totalHits = result.totalHits + counter.unsyncedHits

        // Negative if Redis removed the counter, so keep the local window
        if (result.msBeforeReset >= 0) {
          counter.resetTime = Date.now() + result.msBeforeReset

          // Update the local expiration if our counter is still in the cache
          if (this.counters.get(key) === counter) {
            this.counters.set(key, counter, { ttl: result.msBeforeReset })
          }
        }
      } while (this.mustSync(counter))
    } finally {
      // No await between the last mustSync() check and here, so new hits always start a new sync
      counter.syncing = undefined
    }
  }

  private onSyncError (err: Error) {
    const now = Date.now()

    // Log once per backoff
    if (now - this.lastSyncError >= SYNC_ERROR_BACKOFF_MS) {
      logger.warn('Cannot sync rate limit counters with Redis, only counting hits of this process.', { err })
    }

    this.lastSyncError = now
  }
}
