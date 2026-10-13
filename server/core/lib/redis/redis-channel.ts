import { createLogger } from '../../helpers/logger.js'
import { isRedisInitialized, publishToRedis, subscribeToRedis } from './redis-client.js'

const logger = createLogger('redis')

// The payload is required, unless the channel has none
type ChannelArgs<T> = [T] extends [undefined] ? [] : [payload: T]

// A typed pub/sub channel shared by every process of the platform. Payloads are JSON encoded
export class RedisChannel<T = undefined> {
  constructor (private readonly name: string) {
  }

  // Rejects on failure: for callers that must know the other processes were notified
  publish (...[ payload ]: ChannelArgs<T>) {
    return publishToRedis(this.name, JSON.stringify(payload ?? null))
  }

  // Fire and forget: for invalidations. CLI scripts and tests can run without Redis
  broadcast (...args: ChannelArgs<T>) {
    if (!isRedisInitialized()) return

    this.publish(...args)
      .catch(err => logger.error(`Cannot publish on Redis channel ${this.name}.`, { err }))
  }

  subscribe (handler: (payload: T) => void | Promise<void>) {
    return subscribeToRedis(this.name, async message => {
      let payload: T

      try {
        payload = JSON.parse(message)
      } catch (err) {
        logger.warn(`Cannot parse message of Redis channel ${this.name}.`, { err })
        return
      }

      // Payloads are not logged: some contain secrets (OAuth tokens...). Handlers catch their errors to log context
      try {
        await handler(payload)
      } catch (err) {
        logger.error(`Error in handler of Redis channel ${this.name}.`, { err })
      }
    })
  }
}
