import * as express from 'express'
import { createClient, RedisClient } from 'redis'
import { logger } from '../helpers/logger'
import { generateRandomString } from '../helpers/utils'
import { CONFIG, USER_PASSWORD_RESET_LIFETIME, VIDEO_VIEW_LIFETIME } from '../initializers'

type CachedRoute = {
  body: string,
  contentType?: string
  statusCode?: string
}

class Redis {

  private static instance: Redis
  private initialized = false
  private client: RedisClient
  private prefix: string

  private constructor () {}

  static getRedisClient () {
    return Object.assign({},
      (CONFIG.REDIS.AUTH && CONFIG.REDIS.AUTH != null) ? { password: CONFIG.REDIS.AUTH } : {},
      (CONFIG.REDIS.DB) ? { db: CONFIG.REDIS.DB } : {},
      (CONFIG.REDIS.HOSTNAME && CONFIG.REDIS.PORT) ?
      { host: CONFIG.REDIS.HOSTNAME, port: CONFIG.REDIS.PORT } :
      { path: CONFIG.REDIS.SOCKET }
    )
  }

  init () {
    // Already initialized
    if (this.initialized === true) return
    this.initialized = true

    this.client = createClient(Redis.getRedisClient())

    this.client.on('error', err => {
      logger.error('Error in Redis client.', { err })
      process.exit(-1)
    })

    if (CONFIG.REDIS.AUTH) {
      this.client.auth(CONFIG.REDIS.AUTH)
    }

    this.prefix = 'redis-' + CONFIG.WEBSERVER.HOST + '-'
  }

  async setResetPasswordVerificationString (userId: number) {
    const generatedString = await generateRandomString(32)

    await this.setValue(this.generateResetPasswordKey(userId), generatedString, USER_PASSWORD_RESET_LIFETIME)

    return generatedString
  }

  async getResetPasswordLink (userId: number) {
    return this.getValue(this.generateResetPasswordKey(userId))
  }

  setView (ip: string, videoUUID: string) {
    return this.setValue(this.buildViewKey(ip, videoUUID), '1', VIDEO_VIEW_LIFETIME)
  }

  async isViewExists (ip: string, videoUUID: string) {
    return this.exists(this.buildViewKey(ip, videoUUID))
  }

  async getCachedRoute (req: express.Request)
  async getCachedRoute (route: string, method: string)
  async getCachedRoute (req: express.Request | string, method?: string) {
    if ((req as express.Request).originalUrl !== undefined) {
      return (await this.getObject(this.buildCachedRouteKey(req as express.Request))) as CachedRoute
    }
    if (typeof req === 'string' && method) {
      return (await this.getObject(this.buildCachedRouteKey(req, method))) as CachedRoute
    }
    throw Error('Could not get cached route.')
  }

  async getCachedRouteWithPrefix (req: express.Request, prefix) {
    return (await this.getObject(this.buildCachedRouteKeyWithPrefix(req, prefix))) as CachedRoute
  }

  getCachedKeysMatchingPattern (pattern: string) {
    return new Promise<string[]>((res, rej) => {
      this.client.keys(this.prefix + pattern, (err, value) => {
        if (err) return rej(err)

        return res(value)
      })
    })
  }

  setCachedRoute (req: express.Request, body: any, lifetime: number, contentType?: string, statusCode?: number, prefix?: string) {
    const cached: CachedRoute = Object.assign({}, {
      body: body.toString()
    },
      contentType ? { contentType } : null,
      statusCode ? { statusCode: statusCode.toString() } : null
    )

    return this.setObject(prefix ? this.buildCachedRouteKeyWithPrefix(req, prefix) : this.buildCachedRouteKey(req),
                          cached,
                          lifetime)
  }

  delCachedRoute (req: express.Request)
  delCachedRoute (route: string, method: string)
  delCachedRoute (req: express.Request | string, method?: string) {
    if ((req as express.Request).originalUrl !== undefined) {
      return this.delObject(this.buildCachedRouteKey(req as express.Request))
    }
    if (typeof req === 'string' && method) {
      return this.delObject(this.buildCachedRouteKey(req, method))
    }
  }

  async delCachedPrefix (prefix: string) {
    (await this.getCachedKeysMatchingPattern(prefix + '*')).forEach(async key => {
      await this.delObject(key)
    })
  }

  generateResetPasswordKey (userId: number): string {
    return 'reset-password-' + userId
  }

  buildViewKey (ip: string, videoUUID: string): string {
    return videoUUID + '-' + ip
  }

  buildCachedRouteKey (req: express.Request)
  buildCachedRouteKey (route: string, method: string)
  buildCachedRouteKey (req: express.Request | string, method?: string): string {
    if ((req as express.Request).originalUrl !== undefined) {
      const _req = (req as express.Request)
      return _req.method + '-' + _req.originalUrl
    }
    if (typeof req === 'string' && method) {
      return method + '-' + req
    }
    throw Error('Could not build cache key.')
  }

  buildCachedRouteKeyWithPrefix (req: express.Request, prefix: string) {
    return prefix + '-' + this.buildCachedRouteKey(req)
  }

  private getValue (key: string) {
    return new Promise<string>((res, rej) => {
      this.client.get(this.prefix + key, (err, value) => {
        if (err) return rej(err)

        return res(value)
      })
    })
  }

  private setValue (key: string, value: string, expirationMilliseconds: number) {
    return new Promise<void>((res, rej) => {
      this.client.set(this.prefix + key, value, 'PX', expirationMilliseconds, (err, ok) => {
        if (err) return rej(err)

        if (ok !== 'OK') return rej(new Error('Redis set result is not OK.'))

        return res()
      })
    })
  }

  private setObject (key: string, obj: { [ id: string ]: string }, expirationMilliseconds: number) {
    return new Promise<void>((res, rej) => {
      this.client.hmset(this.prefix + key, obj, (err, ok) => {
        if (err) return rej(err)
        if (!ok) return rej(new Error('Redis mset result is not OK.'))

        this.client.pexpire(this.prefix + key, expirationMilliseconds, (err, ok) => {
          if (err) return rej(err)
          if (!ok) return rej(new Error('Redis expiration result is not OK.'))

          return res()
        })
      })
    })
  }

  private getObject (key: string) {
    return new Promise<{ [ id: string ]: string }>((res, rej) => {
      this.client.hgetall(this.prefix + key, (err, value) => {
        if (err) return rej(err)

        return res(value)
      })
    })
  }

  private delObject (key: string) {
    return new Promise<void>((res, rej) => {
      this.client.del(this.prefix + key, (err) => {
        if (err) return rej(err)

        return res()
      })
    })
  }

  private exists (key: string) {
    return new Promise<boolean>((res, rej) => {
      this.client.exists(this.prefix + key, (err, existsNumber) => {
        if (err) return rej(err)

        return res(existsNumber === 1)
      })
    })
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  Redis
}
