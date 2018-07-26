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

  static getRedisClient () {
    return Object.assign({},
      (CONFIG.REDIS.AUTH && CONFIG.REDIS.AUTH != null) ? { password: CONFIG.REDIS.AUTH } : {},
      (CONFIG.REDIS.DB) ? { db: CONFIG.REDIS.DB } : {},
      (CONFIG.REDIS.HOSTNAME && CONFIG.REDIS.PORT) ?
      { host: CONFIG.REDIS.HOSTNAME, port: CONFIG.REDIS.PORT } :
      { path: CONFIG.REDIS.SOCKET }
    )
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

  async getCachedRoute (req: express.Request) {
    const cached = await this.getObject(this.buildCachedRouteKey(req))

    return cached as CachedRoute
  }

  setCachedRoute (req: express.Request, body: any, lifetime: number, contentType?: string, statusCode?: number) {
    const cached: CachedRoute = Object.assign({}, {
      body: body.toString()
    },
    (contentType) ? { contentType } : null,
    (statusCode) ? { statusCode: statusCode.toString() } : null
    )

    return this.setObject(this.buildCachedRouteKey(req), cached, lifetime)
  }

  generateResetPasswordKey (userId: number) {
    return 'reset-password-' + userId
  }

  buildViewKey (ip: string, videoUUID: string) {
    return videoUUID + '-' + ip
  }

  buildCachedRouteKey (req: express.Request) {
    return req.method + '-' + req.originalUrl
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
