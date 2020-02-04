import { Model } from 'sequelize-typescript'
import * as Bluebird from 'bluebird'
import { logger } from '@server/helpers/logger'

type ModelCacheType =
  'local-account-name'
  | 'local-actor-name'
  | 'local-actor-url'
  | 'load-video-immutable-id'
  | 'load-video-immutable-url'

type DeleteKey =
  'video'

class ModelCache {

  private static instance: ModelCache

  private readonly localCache: { [id in ModelCacheType]: Map<string, any> } = {
    'local-account-name': new Map(),
    'local-actor-name': new Map(),
    'local-actor-url': new Map(),
    'load-video-immutable-id': new Map(),
    'load-video-immutable-url': new Map()
  }

  private readonly deleteIds: {
    [deleteKey in DeleteKey]: Map<number, { cacheType: ModelCacheType, key: string }[]>
  } = {
    video: new Map()
  }

  private constructor () {
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }

  doCache<T extends Model> (options: {
    cacheType: ModelCacheType
    key: string
    fun: () => Bluebird<T>
    whitelist?: () => boolean
    deleteKey?: DeleteKey
  }) {
    const { cacheType, key, fun, whitelist, deleteKey } = options

    if (whitelist && whitelist() !== true) return fun()

    const cache = this.localCache[cacheType]

    if (cache.has(key)) {
      logger.debug('Model cache hit for %s -> %s.', cacheType, key)
      return Bluebird.resolve<T>(cache.get(key))
    }

    return fun().then(m => {
      if (!m) return m

      if (!whitelist || whitelist()) cache.set(key, m)

      if (deleteKey) {
        const map = this.deleteIds[deleteKey]
        if (!map.has(m.id)) map.set(m.id, [])

        const a = map.get(m.id)
        a.push({ cacheType, key })
      }

      return m
    })
  }

  invalidateCache (deleteKey: DeleteKey, modelId: number) {
    const map = this.deleteIds[deleteKey]

    if (!map.has(modelId)) return

    for (const toDelete of map.get(modelId)) {
      logger.debug('Removing %s -> %d of model cache %s -> %s.', deleteKey, modelId, toDelete.cacheType, toDelete.key)
      this.localCache[toDelete.cacheType].delete(toDelete.key)
    }

    map.delete(modelId)
  }
}

export {
  ModelCache
}
