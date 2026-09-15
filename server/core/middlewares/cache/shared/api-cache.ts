// Thanks: https://github.com/kwhitley/apicache
// We duplicated the library because it is unmaintened and prevent us to upgrade to recent NodeJS versions

import { HttpStatusCodeType } from '@peertube/peertube-models'
import { isTestInstance, parseDurationToMs } from '@peertube/peertube-node-utils'
import { createLogger } from '@server/helpers/logger.js'
import { PEERTUBE_VERSION } from '@server/initializers/constants.js'
import { Redis } from '@server/lib/redis/index.js'
import { asyncMiddleware } from '@server/middlewares/index.js'
import express from 'express'
import { OutgoingHttpHeaders } from 'http'

const logger = createLogger()

export interface APICacheOptions {
  headerBlacklist?: string[]
  excludeStatus?: HttpStatusCodeType[]
}

interface CacheObject {
  status: number
  headers: OutgoingHttpHeaders
  data: any
  encoding: BufferEncoding
  timestamp: number
}

export class ApiCache {
  private readonly options: APICacheOptions

  constructor (options: APICacheOptions) {
    this.options = {
      headerBlacklist: [],
      excludeStatus: [],

      ...options
    }
  }

  buildMiddleware (strDuration: string) {
    const duration = parseDurationToMs(strDuration)

    return asyncMiddleware(
      async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const key = this.getCacheKey(req)
        const redis = Redis.Instance.getClient()

        if (!Redis.Instance.isConnected()) return this.makeResponseCacheable(res, next, key, duration)

        try {
          const obj = await redis.hgetall(key)
          if (obj?.response) {
            return this.sendCachedResponse(req, res, JSON.parse(obj.response), duration)
          }

          return this.makeResponseCacheable(res, next, key, duration)
        } catch (err) {
          return this.makeResponseCacheable(res, next, key, duration)
        }
      }
    )
  }

  // Cached responses and the groups they belong to are shared by every process of the platform
  clearGroupSafe (group: string) {
    const run = async () => {
      if (!Redis.Instance.isConnected()) return

      const redis = Redis.Instance.getClient()
      const groupKey = this.getGroupKey(group)

      const cacheKeys = await redis.smembers(groupKey)

      if (cacheKeys.length !== 0) await redis.del(...cacheKeys)

      await redis.del(groupKey)
    }

    run()
      .catch(err => logger.error('Cannot clear API cache group %s.', group, { err }))
  }

  // Every process of the platform must build the same key so they share their cached responses
  // The version changes the entries of the previous PeerTube release, which may have serialized them differently
  private getCacheKey (req: express.Request) {
    return this.getKeyPrefix() + 'response-' + req.originalUrl
  }

  private getGroupKey (group: string) {
    return this.getKeyPrefix() + 'group-' + group
  }

  private getKeyPrefix () {
    return Redis.Instance.getPrefix() + 'api-cache-' + PEERTUBE_VERSION + '-'
  }

  private shouldCacheResponse (response: express.Response) {
    if (!response) return false
    if (this.options.excludeStatus.includes(response.statusCode as HttpStatusCodeType)) return false

    return true
  }

  private async addGroupEntries (key: string, res: express.Response, duration: number) {
    const groups: string[] = res.locals.apicacheGroups || []
    if (groups.length === 0) return

    const redis = Redis.Instance.getClient()

    for (const group of groups) {
      const groupKey = this.getGroupKey(group)

      await redis.sadd(groupKey, key)
      // The group index must outlive the entries it references
      await redis.expire(groupKey, Math.ceil(duration / 1000) + 1)
    }
  }

  private filterBlacklistedHeaders (headers: OutgoingHttpHeaders) {
    return Object.keys(headers)
      .filter(key => !this.options.headerBlacklist.includes(key))
      .reduce((acc, header) => {
        acc[header] = headers[header]

        return acc
      }, {})
  }

  private createCacheObject (status: number, headers: OutgoingHttpHeaders, data: any, encoding: BufferEncoding) {
    return {
      status,
      headers: this.filterBlacklistedHeaders(headers),
      data,
      encoding,

      // Seconds since epoch, used to properly decrement max-age headers in cached responses.
      timestamp: new Date().getTime() / 1000
    }
  }

  private async cacheResponse (key: string, value: object, duration: number) {
    if (!Redis.Instance.isConnected()) return

    const redis = Redis.Instance.getClient()

    await Promise.all([
      redis.hset(key, 'response', JSON.stringify(value)),
      redis.hset(key, 'duration', duration + ''),
      redis.expire(key, duration / 1000)
    ])
  }

  private accumulateContent (res: express.Response, content: any) {
    if (!content) return

    if (typeof content === 'string') {
      res.locals.apicache.content = (res.locals.apicache.content || '') + content
      return
    }

    if (Buffer.isBuffer(content)) {
      let oldContent = res.locals.apicache.content

      if (typeof oldContent === 'string') {
        oldContent = Buffer.from(oldContent)
      }

      if (!oldContent) {
        oldContent = Buffer.alloc(0)
      }

      res.locals.apicache.content = Buffer.concat(
        [ oldContent, content ],
        oldContent.length + content.length
      )

      return
    }

    res.locals.apicache.content = content
  }

  private makeResponseCacheable (res: express.Response, next: express.NextFunction, key: string, duration: number) {
    const self = this

    res.locals.apicache = {
      write: res.write.bind(res),
      writeHead: res.writeHead.bind(res),
      end: res.end.bind(res),
      cacheable: true,
      content: undefined,
      headers: undefined
    }

    // Patch express
    res.writeHead = function () {
      if (self.shouldCacheResponse(res)) {
        res.setHeader('cache-control', 'max-age=' + (duration / 1000).toFixed(0))
      } else {
        res.setHeader('cache-control', 'no-cache, no-store, must-revalidate')
      }

      res.locals.apicache.headers = Object.assign({}, res.getHeaders())
      return res.locals.apicache.writeHead.apply(this, arguments as any)
    }

    res.write = function (chunk: any) {
      self.accumulateContent(res, chunk)
      return res.locals.apicache.write.apply(this, arguments as any)
    }

    res.end = function (content: any, encoding: BufferEncoding) {
      if (self.shouldCacheResponse(res)) {
        self.accumulateContent(res, content)

        if (res.locals.apicache.cacheable && res.locals.apicache.content) {
          const headers = res.locals.apicache.headers || res.getHeaders()
          const cacheObject = self.createCacheObject(
            res.statusCode,
            headers,
            res.locals.apicache.content,
            encoding
          )
          self.cacheResponse(key, cacheObject, duration)
            .then(() => self.addGroupEntries(key, res, duration))
            .catch(err => logger.error('Cannot cache response', { err }))
        }
      }

      res.locals.apicache.end.apply(this, arguments as any)
    } as any

    next()
  }

  private sendCachedResponse (request: express.Request, response: express.Response, cacheObject: CacheObject, duration: number) {
    const headers = response.getHeaders()

    if (isTestInstance()) {
      Object.assign(headers, {
        'x-api-cache-cached': 'true'
      })
    }

    Object.assign(headers, this.filterBlacklistedHeaders(cacheObject.headers || {}), {
      'x-request-id': response.getHeader('x-request-id'),

      // Set properly decremented max-age header
      // This ensures that max-age is in sync with the cache expiration
      'cache-control': 'max-age=' +
        Math.max(
          0,
          duration / 1000 - (new Date().getTime() / 1000 - cacheObject.timestamp)
        ).toFixed(0)
    })

    // unstringify buffers
    let data = cacheObject.data
    if (data?.type === 'Buffer') {
      data = typeof data.data === 'number'
        ? Buffer.alloc(data.data)
        : Buffer.from(data.data)
    }

    // Test Etag against If-None-Match for 304
    const cachedEtag = cacheObject.headers.etag
    const requestEtag = request.headers['if-none-match']

    if (requestEtag && cachedEtag === requestEtag) {
      response.writeHead(304, headers)
      return response.end()
    }

    response.writeHead(cacheObject.status || 200, headers)

    return response.end(data, cacheObject.encoding)
  }
}
