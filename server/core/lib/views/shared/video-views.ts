import { buildUUID } from '@peertube/peertube-node-utils'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { VIEW_LIFETIME } from '@server/initializers/constants.js'
import { sendView } from '@server/lib/activitypub/send/send-view.js'
import { getCachedVideoDuration } from '@server/lib/video.js'
import { getServerActor } from '@server/models/application/application.js'
import { MVideo, MVideoImmutable } from '@server/types/models/index.js'
import { LRUCache } from 'lru-cache'
import { Redis } from '../../redis.js'
import { CONFIG } from '@server/initializers/config.js'

const lTags = loggerTagsFactory('views')

export class VideoViews {

  private readonly viewsCache = new LRUCache<string, boolean>({
    max: 10_000,
    ttl: VIEW_LIFETIME.VIEW
  })

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
  }) {
    const { video } = options

    logger.debug('Adding remote view to video %s.', video.uuid, { ...lTags(video.uuid) })

    await this.addView(video)

    return true
  }

  // ---------------------------------------------------------------------------

  private async addView (video: MVideoImmutable) {
    const promises: Promise<any>[] = []

    if (video.isOwned()) {
      promises.push(Redis.Instance.addLocalVideoView(video.id))
    }

    promises.push(Redis.Instance.addVideoViewStats(video.id))

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
}
