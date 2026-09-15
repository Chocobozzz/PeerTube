import { createLogger } from '@server/helpers/logger.js'
import { LRU_CACHE } from '@server/initializers/constants.js'
import { Redis } from '@server/lib/redis/index.js'
import { LRUCache } from 'lru-cache'
import { Model } from 'sequelize-typescript'

const logger = createLogger()

type ModelCacheType =
  | 'server-account'
  | 'local-actor-name'
  | 'local-actor-url'
  | 'load-video-immutable-id'
  | 'load-video-immutable-url'

type DeleteKey = 'video'

/**
 * A read cache in front of PostgreSQL, local to the process
 *
 * Several PeerTube processes can serve the same platform
 * So an entry invalidated by one of them is also invalidated on the others through Redis
 */
class ModelCache {
  private static instance: ModelCache

  private readonly localCache: { [id in ModelCacheType]: LRUCache<string, any> } = {
    'server-account': this.buildCache(),
    'local-actor-name': this.buildCache(),
    'local-actor-url': this.buildCache(),
    'load-video-immutable-id': this.buildCache(),
    'load-video-immutable-url': this.buildCache()
  }

  private readonly deleteIds: {
    [deleteKey in DeleteKey]: LRUCache<number, { cacheType: ModelCacheType, key: string }[]>
  } = {
    video: new LRUCache({
      max: LRU_CACHE.MODEL_CACHE.MAX_SIZE,
      ttl: LRU_CACHE.MODEL_CACHE.TTL,
      // A cache entry must not outlive its index entry, otherwise it could not be invalidated anymore
      dispose: entries => {
        for (const { cacheType, key } of entries) {
          this.localCache[cacheType].delete(key)
        }
      }
    })
  }

  // Caches that live outside of this class but must be dropped along a cache type (the memoized server actor...)
  private readonly cacheTypeClearedHandlers = new Map<ModelCacheType, (() => void)[]>()

  private constructor () {
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  // Keep in sync with the other processes of this platform
  async listenForInvalidations () {
    await Redis.Instance.subscribeToModelCacheInvalidation(payload => {
      if (payload?.type === 'delete-key') {
        this.invalidateCacheLocally(payload.deleteKey as DeleteKey, payload.modelId)
      } else if (payload?.type === 'cache-type') {
        this.clearCacheLocally(payload.cacheType as ModelCacheType)
      }
    })
  }

  registerCacheTypeClearedHandler (cacheType: ModelCacheType, handler: () => void) {
    if (!this.cacheTypeClearedHandlers.has(cacheType)) this.cacheTypeClearedHandlers.set(cacheType, [])

    this.cacheTypeClearedHandlers.get(cacheType).push(handler)
  }

  doCache<T extends Model> (options: {
    cacheType: ModelCacheType
    key: string
    fun: () => Promise<T>
    whitelist?: () => boolean
    deleteKey?: DeleteKey
  }) {
    const { cacheType, key, fun, whitelist, deleteKey } = options

    if (whitelist && whitelist() !== true) return fun()

    const cache = this.localCache[cacheType]

    if (cache.has(key)) {
      logger.debug('Model cache hit for %s -> %s.', cacheType, key)
      return Promise.resolve<T>(cache.get(key))
    }

    return fun().then(m => {
      if (!m) return m

      if (!whitelist || whitelist()) cache.set(key, m)

      if (deleteKey) {
        const map = this.deleteIds[deleteKey]
        const entries = map.get(m.id) ?? []

        entries.push({ cacheType, key })

        // Also refreshes the TTL of the index entry
        map.set(m.id, entries)
      }

      return m
    })
  }

  invalidateCache (deleteKey: DeleteKey, modelId: number) {
    this.invalidateCacheLocally(deleteKey, modelId)

    this.broadcastInvalidation({ type: 'delete-key', deleteKey, modelId })
  }

  clearCache (cacheType: ModelCacheType) {
    this.clearCacheLocally(cacheType)

    this.broadcastInvalidation({ type: 'cache-type', cacheType })
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private buildCache () {
    return new LRUCache<string, any>({ max: LRU_CACHE.MODEL_CACHE.MAX_SIZE, ttl: LRU_CACHE.MODEL_CACHE.TTL })
  }

  private invalidateCacheLocally (deleteKey: DeleteKey, modelId: number) {
    const map = this.deleteIds[deleteKey]
    if (!map?.has(modelId)) return

    for (const toDelete of map.get(modelId)) {
      logger.debug('Removing %s -> %d of model cache %s -> %s.', deleteKey, modelId, toDelete.cacheType, toDelete.key)
      this.localCache[toDelete.cacheType].delete(toDelete.key)
    }

    map.delete(modelId)
  }

  private clearCacheLocally (cacheType: ModelCacheType) {
    this.localCache[cacheType]?.clear()

    for (const handler of this.cacheTypeClearedHandlers.get(cacheType) || []) {
      handler()
    }
  }

  private broadcastInvalidation (payload: Parameters<typeof Redis.Instance.publishModelCacheInvalidation>[0]) {
    if (!Redis.Instance.isInitialized()) return

    Redis.Instance.publishModelCacheInvalidation(payload)
      .catch(err => logger.error('Cannot broadcast model cache invalidation.', { err }))
  }
}

export {
  ModelCache
}
