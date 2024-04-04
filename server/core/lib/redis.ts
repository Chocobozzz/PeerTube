import { Redis as IoRedis, RedisOptions } from 'ioredis'
import { exists } from '@server/helpers/custom-validators/misc.js'
import { sha256 } from '@peertube/peertube-node-utils'
import { logger } from '../helpers/logger.js'
import { generateRandomString } from '../helpers/utils.js'
import { CONFIG } from '../initializers/config.js'
import {
  AP_CLEANER,
  CONTACT_FORM_LIFETIME,
  EMAIL_VERIFY_LIFETIME,
  RESUMABLE_UPLOAD_SESSION_LIFETIME,
  TWO_FACTOR_AUTH_REQUEST_TOKEN_LIFETIME,
  USER_PASSWORD_CREATE_LIFETIME,
  USER_PASSWORD_RESET_LIFETIME,
  VIEW_LIFETIME,
  WEBSERVER
} from '../initializers/constants.js'

class Redis {

  private static instance: Redis
  private initialized = false
  private connected = false
  private client: IoRedis
  private prefix: string

  private constructor () {
  }

  init () {
    // Already initialized
    if (this.initialized === true) return
    this.initialized = true

    const redisMode = CONFIG.REDIS.SENTINEL.ENABLED ? 'sentinel' : 'standalone'
    logger.info('Connecting to redis ' + redisMode + '...')

    this.client = new IoRedis(Redis.getRedisClientOptions('', { enableAutoPipelining: true }))
    this.client.on('error', err => logger.error('Redis failed to connect', { err }))
    this.client.on('connect', () => {
      logger.info('Connected to redis.')

      this.connected = true
    })
    this.client.on('reconnecting', (ms) => {
      logger.error(`Reconnecting to redis in ${ms}.`)
    })
    this.client.on('close', () => {
      logger.error('Connection to redis has closed.')
      this.connected = false
    })

    this.client.on('end', () => {
      logger.error('Connection to redis has closed and no more reconnects will be done.')
    })

    this.prefix = 'redis-' + WEBSERVER.HOST + '-'
  }

  static getRedisClientOptions (name?: string, options: RedisOptions = {}): RedisOptions {
    const connectionName = [ 'PeerTube', name ].join('')
    const connectTimeout = 20000 // Could be slow since node use sync call to compile PeerTube

    if (CONFIG.REDIS.SENTINEL.ENABLED) {
      return {
        connectionName,
        connectTimeout,
        enableTLSForSentinelMode: CONFIG.REDIS.SENTINEL.ENABLE_TLS,
        sentinelPassword: CONFIG.REDIS.AUTH,
        sentinels: CONFIG.REDIS.SENTINEL.SENTINELS,
        name: CONFIG.REDIS.SENTINEL.MASTER_NAME,
        ...options
      }
    }

    return {
      connectionName,
      connectTimeout,
      password: CONFIG.REDIS.AUTH,
      db: CONFIG.REDIS.DB,
      host: CONFIG.REDIS.HOSTNAME,
      port: CONFIG.REDIS.PORT,
      path: CONFIG.REDIS.SOCKET,
      showFriendlyErrorStack: true,
      ...options
    }
  }

  getClient () {
    return this.client
  }

  getPrefix () {
    return this.prefix
  }

  isConnected () {
    return this.connected
  }

  /* ************ Forgot password ************ */

  async setResetPasswordVerificationString (userId: number) {
    const generatedString = await generateRandomString(32)

    await this.setValue(this.generateResetPasswordKey(userId), generatedString, USER_PASSWORD_RESET_LIFETIME)

    return generatedString
  }

  async setCreatePasswordVerificationString (userId: number) {
    const generatedString = await generateRandomString(32)

    await this.setValue(this.generateResetPasswordKey(userId), generatedString, USER_PASSWORD_CREATE_LIFETIME)

    return generatedString
  }

  async removePasswordVerificationString (userId: number) {
    return this.removeValue(this.generateResetPasswordKey(userId))
  }

  async getResetPasswordVerificationString (userId: number) {
    return this.getValue(this.generateResetPasswordKey(userId))
  }

  /* ************ Two factor auth request ************ */

  async setTwoFactorRequest (userId: number, otpSecret: string) {
    const requestToken = await generateRandomString(32)

    await this.setValue(this.generateTwoFactorRequestKey(userId, requestToken), otpSecret, TWO_FACTOR_AUTH_REQUEST_TOKEN_LIFETIME)

    return requestToken
  }

  async getTwoFactorRequestToken (userId: number, requestToken: string) {
    return this.getValue(this.generateTwoFactorRequestKey(userId, requestToken))
  }

  /* ************ Email verification ************ */

  async setUserVerifyEmailVerificationString (userId: number) {
    const generatedString = await generateRandomString(32)

    await this.setValue(this.generateUserVerifyEmailKey(userId), generatedString, EMAIL_VERIFY_LIFETIME)

    return generatedString
  }

  async getUserVerifyEmailLink (userId: number) {
    return this.getValue(this.generateUserVerifyEmailKey(userId))
  }

  async setRegistrationVerifyEmailVerificationString (registrationId: number) {
    const generatedString = await generateRandomString(32)

    await this.setValue(this.generateRegistrationVerifyEmailKey(registrationId), generatedString, EMAIL_VERIFY_LIFETIME)

    return generatedString
  }

  async getRegistrationVerifyEmailLink (registrationId: number) {
    return this.getValue(this.generateRegistrationVerifyEmailKey(registrationId))
  }

  /* ************ Contact form per IP ************ */

  async setContactFormIp (ip: string) {
    return this.setValue(this.generateContactFormKey(ip), '1', CONTACT_FORM_LIFETIME)
  }

  async doesContactFormIpExist (ip: string) {
    return this.exists(this.generateContactFormKey(ip))
  }

  /* ************ Views per IP ************ */

  setSessionIdVideoView (ip: string, videoUUID: string) {
    return this.setValue(this.generateSessionIdViewKey(ip, videoUUID), '1', VIEW_LIFETIME.VIEW)
  }

  async doesVideoSessionIdViewExist (sessionId: string, videoUUID: string) {
    return this.exists(this.generateSessionIdViewKey(sessionId, videoUUID))
  }

  /* ************ Video views stats ************ */

  addVideoViewStats (videoId: number) {
    const { videoKey, setKey } = this.generateVideoViewStatsKeys({ videoId })

    return Promise.all([
      this.addToSet(setKey, videoId.toString()),
      this.increment(videoKey)
    ])
  }

  async getVideoViewsStats (videoId: number, hour: number) {
    const { videoKey } = this.generateVideoViewStatsKeys({ videoId, hour })

    const valueString = await this.getValue(videoKey)
    const valueInt = parseInt(valueString, 10)

    if (isNaN(valueInt)) {
      logger.error('Cannot get videos views stats of video %d in hour %d: views number is NaN (%s).', videoId, hour, valueString)
      return undefined
    }

    return valueInt
  }

  async listVideosViewedForStats (hour: number) {
    const { setKey } = this.generateVideoViewStatsKeys({ hour })

    const stringIds = await this.getSet(setKey)
    return stringIds.map(s => parseInt(s, 10))
  }

  deleteVideoViewsStats (videoId: number, hour: number) {
    const { setKey, videoKey } = this.generateVideoViewStatsKeys({ videoId, hour })

    return Promise.all([
      this.deleteFromSet(setKey, videoId.toString()),
      this.deleteKey(videoKey)
    ])
  }

  /* ************ Local video views buffer ************ */

  addLocalVideoView (videoId: number) {
    const { videoKey, setKey } = this.generateLocalVideoViewsKeys(videoId)

    return Promise.all([
      this.addToSet(setKey, videoId.toString()),
      this.increment(videoKey)
    ])
  }

  async getLocalVideoViews (videoId: number) {
    const { videoKey } = this.generateLocalVideoViewsKeys(videoId)

    const valueString = await this.getValue(videoKey)
    const valueInt = parseInt(valueString, 10)

    if (isNaN(valueInt)) {
      logger.error('Cannot get videos views of video %d: views number is NaN (%s).', videoId, valueString)
      return undefined
    }

    return valueInt
  }

  async listLocalVideosViewed () {
    const { setKey } = this.generateLocalVideoViewsKeys()

    const stringIds = await this.getSet(setKey)
    return stringIds.map(s => parseInt(s, 10))
  }

  deleteLocalVideoViews (videoId: number) {
    const { setKey, videoKey } = this.generateLocalVideoViewsKeys(videoId)

    return Promise.all([
      this.deleteFromSet(setKey, videoId.toString()),
      this.deleteKey(videoKey)
    ])
  }

  /* ************ Video viewers stats ************ */

  getLocalVideoViewer (options: {
    key?: string
    // Or
    ip?: string
    videoId?: number
  }) {
    if (options.key) return this.getObject(options.key)

    const { viewerKey } = this.generateLocalVideoViewerKeys(options.ip, options.videoId)

    return this.getObject(viewerKey)
  }

  setLocalVideoViewer (sessionId: string, videoId: number, object: any) {
    const { setKey, viewerKey } = this.generateLocalVideoViewerKeys(sessionId, videoId)

    return Promise.all([
      this.addToSet(setKey, viewerKey),
      this.setObject(viewerKey, object)
    ])
  }

  listLocalVideoViewerKeys () {
    const { setKey } = this.generateLocalVideoViewerKeys()

    return this.getSet(setKey)
  }

  deleteLocalVideoViewersKeys (key: string) {
    const { setKey } = this.generateLocalVideoViewerKeys()

    return Promise.all([
      this.deleteFromSet(setKey, key),
      this.deleteKey(key)
    ])
  }

  /* ************ Resumable uploads final responses ************ */

  setUploadSession (uploadId: string) {
    return this.setValue('resumable-upload-' + uploadId, '', RESUMABLE_UPLOAD_SESSION_LIFETIME)
  }

  doesUploadSessionExist (uploadId: string) {
    return this.exists('resumable-upload-' + uploadId)
  }

  deleteUploadSession (uploadId: string) {
    return this.deleteKey('resumable-upload-' + uploadId)
  }

  /* ************ AP resource unavailability ************ */

  async addAPUnavailability (url: string) {
    const key = this.generateAPUnavailabilityKey(url)

    const value = await this.increment(key)
    await this.setExpiration(key, AP_CLEANER.PERIOD * 2)

    return value
  }

  /* ************ Keys generation ************ */

  private generateLocalVideoViewsKeys (videoId: number): { setKey: string, videoKey: string }
  private generateLocalVideoViewsKeys (): { setKey: string }
  private generateLocalVideoViewsKeys (videoId?: number) {
    return { setKey: `local-video-views-buffer`, videoKey: `local-video-views-buffer-${videoId}` }
  }

  generateLocalVideoViewerKeys (sessionId: string, videoId: number): { setKey: string, viewerKey: string }
  generateLocalVideoViewerKeys (): { setKey: string }
  generateLocalVideoViewerKeys (sessionId?: string, videoId?: number) {
    return {
      setKey: `local-video-viewer-stats-keys`,

      viewerKey: sessionId && videoId
        ? `local-video-viewer-stats-${sessionId}-${videoId}`
        : undefined
    }
  }

  private generateVideoViewStatsKeys (options: { videoId?: number, hour?: number }) {
    const hour = exists(options.hour)
      ? options.hour
      : new Date().getHours()

    return { setKey: `videos-view-h${hour}`, videoKey: `video-view-${options.videoId}-h${hour}` }
  }

  private generateResetPasswordKey (userId: number) {
    return 'reset-password-' + userId
  }

  private generateTwoFactorRequestKey (userId: number, token: string) {
    return 'two-factor-request-' + userId + '-' + token
  }

  private generateUserVerifyEmailKey (userId: number) {
    return 'verify-email-user-' + userId
  }

  private generateRegistrationVerifyEmailKey (registrationId: number) {
    return 'verify-email-registration-' + registrationId
  }

  generateSessionIdViewKey (sessionId: string, videoUUID: string) {
    return `views-${videoUUID}-${sessionId}`
  }

  private generateContactFormKey (ip: string) {
    return 'contact-form-' + sha256(CONFIG.SECRETS.PEERTUBE + '-' + ip)
  }

  private generateAPUnavailabilityKey (url: string) {
    return 'ap-unavailability-' + sha256(url)
  }

  /* ************ Redis helpers ************ */

  private getValue (key: string) {
    return this.client.get(this.prefix + key)
  }

  private getSet (key: string) {
    return this.client.smembers(this.prefix + key)
  }

  private addToSet (key: string, value: string) {
    return this.client.sadd(this.prefix + key, value)
  }

  private deleteFromSet (key: string, value: string) {
    return this.client.srem(this.prefix + key, value)
  }

  private deleteKey (key: string) {
    return this.client.del(this.prefix + key)
  }

  private async getObject (key: string) {
    const value = await this.getValue(key)
    if (!value) return null

    return JSON.parse(value)
  }

  private setObject (key: string, value: { [ id: string ]: number | string }, expirationMilliseconds?: number) {
    return this.setValue(key, JSON.stringify(value), expirationMilliseconds)
  }

  private async setValue (key: string, value: string, expirationMilliseconds?: number) {
    const result = expirationMilliseconds !== undefined
      ? await this.client.set(this.prefix + key, value, 'PX', expirationMilliseconds)
      : await this.client.set(this.prefix + key, value)

    if (result !== 'OK') throw new Error('Redis set result is not OK.')
  }

  private removeValue (key: string) {
    return this.client.del(this.prefix + key)
  }

  private increment (key: string) {
    return this.client.incr(this.prefix + key)
  }

  private async exists (key: string) {
    const result = await this.client.exists(this.prefix + key)

    return result !== 0
  }

  private setExpiration (key: string, ms: number) {
    return this.client.expire(this.prefix + key, ms / 1000)
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  Redis
}
