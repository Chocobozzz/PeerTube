import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { MVideo, MVideoImmutable } from '@server/types/models'
import { VideoViewEvent } from '@shared/models'
import { VideoScope, VideoViewerCounters, VideoViewerStats, VideoViews, ViewerScope } from './shared'

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
    viewEvent?: VideoViewEvent
  }) {
    const { video, ip, viewEvent, currentTime } = options

    logger.debug('Processing local view for %s and ip %s.', video.url, ip, lTags())

    await this.videoViewerStats.addLocalViewer({ video, ip, viewEvent, currentTime })

    const successViewer = await this.videoViewerCounters.addLocalViewer({ video, ip })

    // Do it after added local viewer to fetch updated information
    const watchTime = await this.videoViewerStats.getWatchTime(video.id, ip)

    const successView = await this.videoViews.addLocalView({ video, watchTime, ip })

    return { successView, successViewer }
  }

  async processRemoteView (options: {
    video: MVideo
    viewerId: string | null
    viewerExpires?: Date
  }) {
    const { video, viewerId, viewerExpires } = options

    logger.debug('Processing remote view for %s.', video.url, { viewerExpires, viewerId, ...lTags() })

    if (viewerExpires) await this.videoViewerCounters.addRemoteViewer({ video, viewerId, viewerExpires })
    else await this.videoViews.addRemoteView({ video })
  }

  getViewers (video: MVideo) {
    return this.videoViewerCounters.getViewers(video)
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
