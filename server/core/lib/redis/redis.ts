import { RedisOptions } from 'ioredis'
import * as apUnavailability from './ap-unavailability.js'
import * as contactForm from './contact-form.js'
import * as emailVerification from './email-verification.js'
import * as forgotPassword from './forgot-password.js'
import * as localVideoStatCounters from './local-video-stat-counters.js'
import * as loginFailures from './login-failures.js'
import * as pluginChanges from './plugin-changes.js'
import { PluginChangePayload } from './plugin-changes.js'
import {
  buildLoggedRedisClientOptions,
  duplicateRedisClient,
  getRedisClient,
  getRedisPrefix,
  initRedisClient,
  isRedisConnected,
  isRedisInitialized,
  quitRedisClient,
  StatKind
} from './redis-client.js'
import * as sharedInstanceConfig from './shared-instance-config.js'
import * as tokenInvalidation from './token-invalidation.js'
import { TokenInvalidationPayload } from './token-invalidation.js'
import * as twoFactorRequest from './two-factor-request.js'
import * as uploadSession from './upload-session.js'
import * as videoStatCounters from './video-stat-counters.js'
import * as videoView from './video-view.js'
import * as videoViewerCounters from './video-viewer-counters.js'
import { AddVideoViewerCounterOptions } from './video-viewer-counters.js'
import * as videoViewerStats from './video-viewer-stats.js'
import { LocalVideoViewer, MergeLocalVideoViewerOptions } from './video-viewer-stats.js'

// Facade over the per-theme Redis modules in this directory
export class Redis {
  private static instance: Redis

  private constructor () {
  }

  init () {
    return initRedisClient()
  }

  quit () {
    return quitRedisClient()
  }

  static getRedisClientOptions (name?: string, options: RedisOptions = {}, logOptions = false): RedisOptions {
    return buildLoggedRedisClientOptions(name, options, logOptions)
  }

  getClient () {
    return getRedisClient()
  }

  duplicateClient (name: string) {
    return duplicateRedisClient(name)
  }

  getPrefix () {
    return getRedisPrefix()
  }

  isConnected () {
    return isRedisConnected()
  }

  isInitialized () {
    return isRedisInitialized()
  }

  /* ************ Forgot password ************ */

  setResetPasswordVerificationString (userId: number) {
    return forgotPassword.setResetPasswordVerificationString(userId)
  }

  setCreatePasswordVerificationString (userId: number) {
    return forgotPassword.setCreatePasswordVerificationString(userId)
  }

  removePasswordVerificationString (userId: number) {
    return forgotPassword.removePasswordVerificationString(userId)
  }

  getResetPasswordVerificationString (userId: number) {
    return forgotPassword.getResetPasswordVerificationString(userId)
  }

  /* ************ Two factor auth request ************ */

  setTwoFactorRequest (userId: number, otpSecret: string) {
    return twoFactorRequest.setTwoFactorRequest(userId, otpSecret)
  }

  getTwoFactorRequestToken (userId: number, requestToken: string) {
    return twoFactorRequest.getTwoFactorRequestToken(userId, requestToken)
  }

  /* ************ Login failures ************ */

  addLoginFailure (userId: number, ip: string) {
    return loginFailures.addLoginFailure(userId, ip)
  }

  getLoginFailures (userId: number) {
    return loginFailures.getLoginFailures(userId)
  }

  deleteLoginFailures (userId: number) {
    return loginFailures.deleteLoginFailures(userId)
  }

  /* ************ Email verification ************ */

  setUserVerifyEmailVerificationString (userId: number, isPendingEmail: boolean) {
    return emailVerification.setUserVerifyEmailVerificationString(userId, isPendingEmail)
  }

  getUserVerifyEmailLink (userId: number, isPendingEmail: boolean) {
    return emailVerification.getUserVerifyEmailLink(userId, isPendingEmail)
  }

  deleteUserVerifyEmailLink (userId: number, isPendingEmail: boolean) {
    return emailVerification.deleteUserVerifyEmailLink(userId, isPendingEmail)
  }

  setRegistrationVerifyEmailVerificationString (registrationId: number) {
    return emailVerification.setRegistrationVerifyEmailVerificationString(registrationId)
  }

  getRegistrationVerifyEmailLink (registrationId: number) {
    return emailVerification.getRegistrationVerifyEmailLink(registrationId)
  }

  deleteRegistrationVerifyEmailLink (registrationId: number) {
    return emailVerification.deleteRegistrationVerifyEmailLink(registrationId)
  }

  /* ************ Contact form per IP ************ */

  setContactFormIp (ip: string) {
    return contactForm.setContactFormIp(ip)
  }

  doesContactFormIpExist (ip: string) {
    return contactForm.doesContactFormIpExist(ip)
  }

  /* ************ Views per IP ************ */

  setSessionIdVideoView (ip: string, videoUUID: string) {
    return videoView.setSessionIdVideoView(ip, videoUUID)
  }

  doesVideoSessionIdViewExist (sessionId: string, videoUUID: string) {
    return videoView.doesVideoSessionIdViewExist(sessionId, videoUUID)
  }

  /* ************ Video stats ************ */

  incrementVideoStatCounter (kind: StatKind, videoId: number) {
    return videoStatCounters.incrementVideoStatCounter(kind, videoId)
  }

  getVideoStatCounters (kind: StatKind, videoId: number, hour: number) {
    return videoStatCounters.getVideoStatCounters(kind, videoId, hour)
  }

  listVideosStatCounters (hour: number) {
    return videoStatCounters.listVideosStatCounters(hour)
  }

  deleteVideoStatCounters (videoId: number, hour: number) {
    return videoStatCounters.deleteVideoStatCounters(videoId, hour)
  }

  /* ************ Local video stats buffer ************ */

  incrementLocalVideoStatCounter (kind: StatKind, videoId: number) {
    return localVideoStatCounters.incrementLocalVideoStatCounter(kind, videoId)
  }

  getLocalVideoStatCounters (kind: StatKind, videoId: number) {
    return localVideoStatCounters.getLocalVideoStatCounters(kind, videoId)
  }

  listLocalVideoIdsWithStatCounters () {
    return localVideoStatCounters.listLocalVideoIdsWithStatCounters()
  }

  deleteLocalVideoStatCounters (videoId: number) {
    return localVideoStatCounters.deleteLocalVideoStatCounters(videoId)
  }

  /* ************ Video viewers stats ************ */

  getLocalVideoViewer (options: { key: string }): Promise<LocalVideoViewer> {
    return videoViewerStats.getLocalVideoViewer(options)
  }

  mergeLocalVideoViewer (options: MergeLocalVideoViewerOptions) {
    return videoViewerStats.mergeLocalVideoViewer(options)
  }

  listLocalVideoViewerKeys () {
    return videoViewerStats.listLocalVideoViewerKeys()
  }

  deleteLocalVideoViewersKeys (key: string) {
    return videoViewerStats.deleteLocalVideoViewersKeys(key)
  }

  /* ************ Shared instance config ************ */

  getSharedConfig () {
    return sharedInstanceConfig.getSharedConfig()
  }

  setSharedConfig (value: string) {
    return sharedInstanceConfig.setSharedConfig(value)
  }

  publishConfigChanged () {
    return sharedInstanceConfig.publishConfigChanged()
  }

  subscribeToConfigChanges (handler: () => void) {
    return sharedInstanceConfig.subscribeToConfigChanges(handler)
  }

  /* ************ Cross process invalidation ************ */

  publishTokenInvalidation (payload: TokenInvalidationPayload) {
    return tokenInvalidation.publishTokenInvalidation(payload)
  }

  subscribeToTokenInvalidation (handler: (payload: TokenInvalidationPayload) => void) {
    return tokenInvalidation.subscribeToTokenInvalidation(handler)
  }

  publishPluginChange (payload: PluginChangePayload) {
    return pluginChanges.publishPluginChange(payload)
  }

  subscribeToPluginChanges (handler: (payload: PluginChangePayload) => void) {
    return pluginChanges.subscribeToPluginChanges(handler)
  }

  /* ************ Video viewer counters ************ */

  listVideoIdsWithViewers () {
    return videoViewerCounters.listVideoIdsWithViewers()
  }

  listVideoViewerCounters<T> (videoId: number) {
    return videoViewerCounters.listVideoViewerCounters<T>(videoId)
  }

  addVideoViewerCounter (options: AddVideoViewerCounterOptions) {
    return videoViewerCounters.addVideoViewerCounter(options)
  }

  deleteVideoViewerCounters (videoId: number, viewerIds: string[], newTotal: number) {
    return videoViewerCounters.deleteVideoViewerCounters(videoId, viewerIds, newTotal)
  }

  deleteAllVideoViewerCounters (videoId: number) {
    return videoViewerCounters.deleteAllVideoViewerCounters(videoId)
  }

  /* ************ Resumable uploads final responses ************ */

  setUploadSession (uploadId: string) {
    return uploadSession.setUploadSession(uploadId)
  }

  doesUploadSessionExist (uploadId: string) {
    return uploadSession.doesUploadSessionExist(uploadId)
  }

  deleteUploadSession (uploadId: string) {
    return uploadSession.deleteUploadSession(uploadId)
  }

  /* ************ AP resource unavailability ************ */

  addAPUnavailability (url: string) {
    return apUnavailability.addAPUnavailability(url)
  }

  /* ************ Keys generation ************ */

  generateSessionIdViewKey (sessionId: string, videoUUID: string) {
    return videoView.generateSessionIdViewKey(sessionId, videoUUID)
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
