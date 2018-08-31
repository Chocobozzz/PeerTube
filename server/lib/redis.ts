import * as express from 'express'
import { createClient, RedisClient } from 'redis'
import { logger } from '../helpers/logger'
import { generateRandomString } from '../helpers/utils'
import { CONFIG, USER_PASSWORD_RESET_LIFETIME, USER_EMAIL_VERIFY_LIFETIME, VIDEO_VIEW_LIFETIME } from '../initializers'

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

  async setVerifyEmailVerificationString (userId: number) {
    const generatedString = await generateRandomString(32)

    await this.setValue(this.generateVerifyEmailKey(userId), generatedString, USER_EMAIL_VERIFY_LIFETIME)

    return generatedString
  }

  async getVerifyEmailLink (userId: number) {
    return this.getValue(this.generateVerifyEmailKey(userId))
  }

  setIPVideoView (ip: string, videoUUID: string) {
    return this.setValue(this.buildViewKey(ip, videoUUID), '1', VIDEO_VIEW_LIFETIME)
  }

  async isVideoIPViewExists (ip: string, videoUUID: string) {
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

  addVideoView (videoId: number) {
    const keyIncr = this.generateVideoViewKey(videoId)
    const keySet = this.generateVideosViewKey()

    return Promise.all([
      this.addToSet(keySet, videoId.toString()),
      this.increment(keyIncr)
    ])
  }

  async getVideoViews (videoId: number, hour: number) {
    const key = this.generateVideoViewKey(videoId, hour)

    const valueString = await this.getValue(key)
    return parseInt(valueString, 10)
  }

  async getVideosIdViewed (hour: number) {
    const key = this.generateVideosViewKey(hour)

    const stringIds = await this.getSet(key)
    return stringIds.map(s => parseInt(s, 10))
  }

  deleteVideoViews (videoId: number, hour: number) {
    const keySet = this.generateVideosViewKey(hour)
    const keyIncr = this.generateVideoViewKey(videoId, hour)

    return Promise.all([
      this.deleteFromSet(keySet, videoId.toString()),
      this.deleteKey(keyIncr)
    ])
  }

  generateVideosViewKey (hour?: number) {
    if (!hour) hour = new Date().getHours()

    return `videos-view-h${hour}`
  }

  generateVideoViewKey (videoId: number, hour?: number) {
    if (!hour) hour = new Date().getHours()

    return `video-view-${videoId}-h${hour}`
  }

  generateResetPasswordKey (userId: number) {
    return 'reset-password-' + userId
  }

  generateVerifyEmailKey (userId: number) {
    return 'verify-email-' + userId
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

  private getSet (key: string) {
    return new Promise<string[]>((res, rej) => {
      this.client.smembers(this.prefix + key, (err, value) => {
        if (err) return rej(err)

        return res(value)
      })
    })
  }

  private addToSet (key: string, value: string) {
    return new Promise<string[]>((res, rej) => {
      this.client.sadd(this.prefix + key, value, err => err ? rej(err) : res())
    })
  }

  private deleteFromSet (key: string, value: string) {
    return new Promise<void>((res, rej) => {
      this.client.srem(this.prefix + key, value, err => err ? rej(err) : res())
    })
  }

  private deleteKey (key: string) {
    return new Promise<void>((res, rej) => {
      this.client.del(this.prefix + key, err => err ? rej(err) : res())
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

  private increment (key: string) {
    return new Promise<number>((res, rej) => {
      this.client.incr(this.prefix + key, (err, value) => {
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
