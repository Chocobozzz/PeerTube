import { buildUUID } from '@peertube/peertube-node-utils'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { REMOTE_DOWNLOADS, REMOTE_VIEWS, VIEW_LIFETIME } from '@server/initializers/constants.js'
import { sendDownload } from '@server/lib/activitypub/send/send-download.js'
import { sendView } from '@server/lib/activitypub/send/send-view.js'
import { getCachedVideoDuration } from '@server/lib/video.js'
import { getServerActor } from '@server/models/application/application.js'
import { MVideo, MVideoImmutable } from '@server/types/models/index.js'
import { LRUCache } from 'lru-cache'
import { Redis } from '../../redis.js'

const lTags = loggerTagsFactory('views')

export class VideoStats {
  private readonly viewsCache = new LRUCache<string, boolean>({
    max: 10_000,
    ttl: VIEW_LIFETIME.VIEW
  })

  private readonly remoteViewsCache = new LRUCache<string, boolean>({
    max: 50_000,
    ttl: REMOTE_VIEWS.DEDUPLICATION_LIFETIME
  })

  // Remote instances are trusted to report downloads of our videos, so guard against duplicated/flooded activities
  private readonly remoteDownloadsCache = new LRUCache<string, boolean>({
    max: 50_000,
    ttl: REMOTE_DOWNLOADS.DEDUPLICATION_LIFETIME
  })

  private readonly remoteDownloadsPerHostCache = new LRUCache<string, number>({
    max: 10_000,
    ttl: REMOTE_DOWNLOADS.RATE_LIMIT_LIFETIME
  })

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  async addLocalView (options: {
    video: MVideoImmutable
    sessionId: string
    watchTime: number
  }) {
    const { video, sessionId, watchTime } = options

    logger.debug('Adding local view to video %s.', video.uuid, { watchTime, ...lTags(video.uuid) })

    if (!await this.hasEnoughWatchTime(video, watchTime)) return false

    const viewExists = await this.doesVideoSessionIdViewExist(sessionId, video.uuid)
    if (viewExists) return false

    await this.setSessionIdVideoView(sessionId, video.uuid)

    await this.addView(video)

    await sendView({ byActor: await getServerActor(), video, viewerIdentifier: buildUUID() })

    return true
  }

  async addRemoteView (options: {
    video: MVideo
    viewerId: string | null
  }) {
    const { video, viewerId } = options

    logger.debug('Adding remote view to video %s.', video.uuid, { viewerId, ...lTags(video.uuid) })

    if (viewerId) {
      if (this.remoteViewsCache.has(viewerId)) {
        logger.debug('Ignoring already processed remote view %s.', viewerId, lTags(video.uuid))

        return false
      }

      this.remoteViewsCache.set(viewerId, true)
    }

    await this.addView(video)

    return true
  }

  // ---------------------------------------------------------------------------

  private async addView (video: MVideoImmutable) {
    const promises: Promise<any>[] = []

    if (video.isLocal()) {
      promises.push(Redis.Instance.addLocalVideoStat('views', video.id))
    }

    promises.push(Redis.Instance.addVideoStat('views', video.id))

    await Promise.all(promises)
  }

  private async hasEnoughWatchTime (video: MVideoImmutable, watchTime: number) {
    const { duration, isLive } = await getCachedVideoDuration(video.id)

    const countViewAfterSeconds = CONFIG.VIEWS.VIDEOS.COUNT_VIEW_AFTER / 1000 // Config is in ms
    if (isLive || duration >= countViewAfterSeconds) return watchTime >= countViewAfterSeconds

    // Check more than 50% of the video is watched
    return duration / watchTime < 2
  }

  private doesVideoSessionIdViewExist (sessionId: string, videoUUID: string) {
    const key = Redis.Instance.generateSessionIdViewKey(sessionId, videoUUID)
    const value = this.viewsCache.has(key)
    if (value === true) return Promise.resolve(true)

    return Redis.Instance.doesVideoSessionIdViewExist(sessionId, videoUUID)
  }

  private setSessionIdVideoView (sessionId: string, videoUUID: string) {
    const key = Redis.Instance.generateSessionIdViewKey(sessionId, videoUUID)
    this.viewsCache.set(key, true)

    return Redis.Instance.setSessionIdVideoView(sessionId, videoUUID)
  }

  // ---------------------------------------------------------------------------
  // Download
  // ---------------------------------------------------------------------------

  async addLocalDownload (options: {
    video: MVideoImmutable
  }) {
    const { video } = options

    logger.debug('Adding local download to video %s.', video.uuid, { ...lTags(video.uuid) })

    await this.addDownload(video)

    await sendDownload({ byActor: await getServerActor(), video })

    return true
  }

  async addRemoteDownload (options: {
    video: MVideoImmutable
    downloadId: string
    byActorUrl: string
  }) {
    const { video, downloadId, byActorUrl } = options

    logger.debug('Adding remote download to video %s.', video.uuid, { downloadId, ...lTags(video.uuid) })

    if (this.remoteDownloadsCache.has(downloadId)) {
      logger.debug('Ignoring already processed remote download %s.', downloadId, lTags(video.uuid))

      return false
    }
    this.remoteDownloadsCache.set(downloadId, true)

    // We can't check a remote instance really downloaded the video, so at least limit how much it can inflate our counter
    const rateLimitKey = new URL(byActorUrl).host.toLowerCase() + '-' + video.id
    const hostDownloads = (this.remoteDownloadsPerHostCache.get(rateLimitKey) || 0) + 1
    this.remoteDownloadsPerHostCache.set(rateLimitKey, hostDownloads, { noUpdateTTL: true })

    if (hostDownloads > REMOTE_DOWNLOADS.MAX_PER_HOST_PER_VIDEO) {
      logger.warn('Too many remote downloads of video %s sent by %s, ignoring.', video.uuid, byActorUrl, lTags(video.uuid))

      return false
    }

    await this.addDownload(video)

    return true
  }

  // ---------------------------------------------------------------------------

  private async addDownload (video: MVideoImmutable) {
    const promises: Promise<any>[] = []

    if (video.isLocal()) {
      promises.push(Redis.Instance.addLocalVideoStat('downloads', video.id))
    }

    promises.push(Redis.Instance.addVideoStat('downloads', video.id))

    await Promise.all(promises)
  }
}
