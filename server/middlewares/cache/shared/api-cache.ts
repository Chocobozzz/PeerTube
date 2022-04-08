// Thanks: https://github.com/kwhitley/apicache
// We duplicated the library because it is unmaintened and prevent us to upgrade to recent NodeJS versions

import express from 'express'
import { OutgoingHttpHeaders } from 'http'
import { isTestInstance, parseDurationToMs } from '@server/helpers/core-utils'
import { logger } from '@server/helpers/logger'
import { Redis } from '@server/lib/redis'
import { asyncMiddleware } from '@server/middlewares'
import { HttpStatusCode } from '@shared/models'

export interface APICacheOptions {
  headerBlacklist?: string[]
  excludeStatus?: HttpStatusCode[]
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
  private readonly timers: { [ id: string ]: NodeJS.Timeout } = {}

  private index: { all: string[] } = { all: [] }

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
        const key = Redis.Instance.getPrefix() + 'api-cache-' + req.originalUrl
        const redis = Redis.Instance.getClient()

        if (!Redis.Instance.isConnected()) return this.makeResponseCacheable(res, next, key, duration)

        try {
          const obj = await redis.hGetAll(key)
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

  private shouldCacheResponse (response: express.Response) {
    if (!response) return false
    if (this.options.excludeStatus.includes(response.statusCode)) return false

    return true
  }

  private addIndexEntries (key: string) {
    this.index.all.unshift(key)
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
    } as CacheObject
  }

  private async cacheResponse (key: string, value: object, duration: number) {
    const redis = Redis.Instance.getClient()

    if (Redis.Instance.isConnected()) {
      await Promise.all([
        redis.hSet(key, 'response', JSON.stringify(value)),
        redis.hSet(key, 'duration', duration + ''),
        redis.expire(key, duration / 1000)
      ])
    }

    // add automatic cache clearing from duration, includes max limit on setTimeout
    this.timers[key] = setTimeout(() => {
      this.clear(key)
        .catch(err => logger.error('Cannot clear Redis key %s.', key, { err }))
    }, Math.min(duration, 2147483647))
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
      write: res.write,
      writeHead: res.writeHead,
      end: res.end,
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
          self.addIndexEntries(key)

          const headers = res.locals.apicache.headers || res.getHeaders()
          const cacheObject = self.createCacheObject(
            res.statusCode,
            headers,
            res.locals.apicache.content,
            encoding
          )
          self.cacheResponse(key, cacheObject, duration)
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
      // Set properly decremented max-age header
      // This ensures that max-age is in sync with the cache expiration
      'cache-control':
        'max-age=' +
        Math.max(
          0,
          (duration / 1000 - (new Date().getTime() / 1000 - cacheObject.timestamp))
        ).toFixed(0)
    })

    // unstringify buffers
    let data = cacheObject.data
    if (data && data.type === 'Buffer') {
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

  private async clear (target: string) {
    const redis = Redis.Instance.getClient()

    if (target) {
      clearTimeout(this.timers[target])
      delete this.timers[target]

      try {
        await redis.del(target)
      } catch (err) {
        logger.error('Cannot delete %s in redis cache.', target, { err })
      }

      this.index.all = this.index.all.filter(key => key !== target)
    } else {
      for (const key of this.index.all) {
        clearTimeout(this.timers[key])
        delete this.timers[key]

        try {
          await redis.del(key)
        } catch (err) {
          logger.error('Cannot delete %s in redis cache.', key, { err })
        }
      }

      this.index.all = []
    }

    return this.index
  }
}
