import { Model } from 'sequelize-typescript'
import * as Bluebird from 'bluebird'
import { logger } from '@server/helpers/logger'

type ModelCacheType =
  'local-account-name'
  | 'local-actor-name'
  | 'local-actor-url'

class ModelCache {

  private static instance: ModelCache

  private readonly localCache: { [id in ModelCacheType]: Map<string, any> } = {
    'local-account-name': new Map(),
    'local-actor-name': new Map(),
    'local-actor-url': new Map()
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
  }) {
    const { cacheType, key, fun, whitelist } = options

    if (whitelist && whitelist() !== true) return fun()

    const cache = this.localCache[cacheType]

    if (cache.has(key)) {
      logger.debug('Model cache hit for %s -> %s.', cacheType, key)
      return Bluebird.resolve<T>(cache.get(key))
    }

    return fun().then(m => {
      if (!whitelist || whitelist()) cache.set(key, m)

      return m
    })
  }
}

export {
  ModelCache
}
