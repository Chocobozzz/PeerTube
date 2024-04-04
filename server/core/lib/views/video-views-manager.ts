import { VideoViewEvent } from '@peertube/peertube-models'
import { sha256 } from '@peertube/peertube-node-utils'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { MVideo, MVideoImmutable } from '@server/types/models/index.js'
import { VideoScope, VideoViewerCounters, VideoViewerStats, VideoViews, ViewerScope } from './shared/index.js'

/**
 * If processing a local view:
 *  - We update viewer information (segments watched, watch time etc)
 *  - We add +1 to video viewers counter if this is a new viewer
 *  - We add +1 to video views counter if this is a new view and if the user watched enough seconds
 *  - We send AP message to notify about this viewer and this view
 *  - We update last video time for the user if authenticated
 *
 * If processing a remote view:
 *  - We add +1 to video viewers counter
 *  - We add +1 to video views counter
 *
 * A viewer is a someone that watched one or multiple sections of a video
 * A viewer that watched only a few seconds of a video may not increment the video views counter
 * Viewers statistics are sent to origin instance using the `WatchAction` ActivityPub object
 *
 */

const lTags = loggerTagsFactory('views')

export class VideoViewsManager {

  private static instance: VideoViewsManager

  private videoViewerStats: VideoViewerStats
  private videoViewerCounters: VideoViewerCounters
  private videoViews: VideoViews

  private constructor () {
  }

  init () {
    this.videoViewerStats = new VideoViewerStats()
    this.videoViewerCounters = new VideoViewerCounters()
    this.videoViews = new VideoViews()
  }

  async processLocalView (options: {
    video: MVideoImmutable
    currentTime: number
    ip: string | null
    sessionId?: string
    viewEvent?: VideoViewEvent
  }) {
    const { video, ip, viewEvent, currentTime } = options

    let sessionId = options.sessionId
    if (!sessionId || CONFIG.VIEWS.VIDEOS.TRUST_VIEWER_SESSION_ID !== true) {
      sessionId = sha256(CONFIG.SECRETS + '-' + ip)
    }

    logger.debug(`Processing local view for ${video.url}, ip ${ip} and session id ${sessionId}.`, lTags())

    await this.videoViewerStats.addLocalViewer({ video, ip, sessionId, viewEvent, currentTime })

    const successViewer = await this.videoViewerCounters.addLocalViewer({ video, sessionId })

    // Do it after added local viewer to fetch updated information
    const watchTime = await this.videoViewerStats.getWatchTime(video.id, sessionId)

    const successView = await this.videoViews.addLocalView({ video, watchTime, sessionId })

    return { successView, successViewer }
  }

  async processRemoteView (options: {
    video: MVideo
    viewerId: string | null
    viewerExpires?: Date
    viewerResultCounter?: number
  }) {
    const { video, viewerId, viewerExpires, viewerResultCounter } = options

    logger.debug('Processing remote view for %s.', video.url, { viewerExpires, viewerId, ...lTags() })

    // Viewer
    if (viewerExpires) {
      if (video.remote === false) {
        this.videoViewerCounters.addRemoteViewerOnLocalVideo({ video, viewerId, viewerExpires })
        return
      }

      this.videoViewerCounters.addRemoteViewerOnRemoteVideo({ video, viewerId, viewerExpires, viewerResultCounter })
      return
    }

    // Just a view
    await this.videoViews.addRemoteView({ video })
  }

  getTotalViewersOf (video: MVideo) {
    return this.videoViewerCounters.getTotalViewersOf(video)
  }

  getTotalViewers (options: {
    viewerScope: ViewerScope
    videoScope: VideoScope
  }) {
    return this.videoViewerCounters.getTotalViewers(options)
  }

  buildViewerExpireTime () {
    return this.videoViewerCounters.buildViewerExpireTime()
  }

  processViewerStats () {
    return this.videoViewerStats.processViewerStats()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
