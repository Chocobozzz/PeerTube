import { createClient, RedisClient } from 'redis'
import { logger } from '../helpers/logger'
import { generateRandomString } from '../helpers/utils'
import { CONFIG, USER_PASSWORD_RESET_LIFETIME, VIDEO_VIEW_LIFETIME } from '../initializers'

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

    this.client = createClient({
      host: CONFIG.REDIS.HOSTNAME,
      port: CONFIG.REDIS.PORT
    })

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

  listJobs (jobsPrefix: string, state: string, mode: 'alpha', order: 'ASC' | 'DESC', offset: number, count: number) {
    return new Promise<string[]>((res, rej) => {
      this.client.sort(jobsPrefix + ':jobs:' + state, 'by', mode, order, 'LIMIT', offset.toString(), count.toString(), (err, values) => {
        if (err) return rej(err)

        return res(values)
      })
    })
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

        if (ok !== 'OK') return rej(new Error('Redis result is not OK.'))

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

  private generateResetPasswordKey (userId: number) {
    return 'reset-password-' + userId
  }

  private buildViewKey (ip: string, videoUUID: string) {
    return videoUUID + '-' + ip
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  Redis
}
