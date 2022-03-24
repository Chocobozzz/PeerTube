import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { MVideo } from '@server/types/models'
import { VideoViewEvent } from '@shared/models'
import { VideoViewers, VideoViews } from './shared'

const lTags = loggerTagsFactory('views')

export class VideoViewsManager {

  private static instance: VideoViewsManager

  private videoViewers: VideoViewers
  private videoViews: VideoViews

  private constructor () {
  }

  init () {
    this.videoViewers = new VideoViewers()
    this.videoViews = new VideoViews()
  }

  async processLocalView (options: {
    video: MVideo
    currentTime: number
    ip: string | null
    viewEvent?: VideoViewEvent
  }) {
    const { video, ip, viewEvent, currentTime } = options

    logger.debug('Processing local view for %s and ip %s.', video.url, ip, lTags())

    const successViewer = await this.videoViewers.addLocalViewer({ video, ip, viewEvent, currentTime })

    // Do it after added local viewer to fetch updated information
    const watchTime = await this.videoViewers.getWatchTime(video.id, ip)

    const successView = await this.videoViews.addLocalView({ video, watchTime, ip })

    return { successView, successViewer }
  }

  async processRemoteView (options: {
    video: MVideo
    viewerExpires?: Date
  }) {
    const { video, viewerExpires } = options

    logger.debug('Processing remote view for %s.', video.url, { viewerExpires, ...lTags() })

    if (viewerExpires) await this.videoViewers.addRemoteViewer({ video, viewerExpires })
    else await this.videoViews.addRemoteView({ video })
  }

  getViewers (video: MVideo) {
    return this.videoViewers.getViewers(video)
  }

  buildViewerExpireTime () {
    return this.videoViewers.buildViewerExpireTime()
  }

  processViewers () {
    return this.videoViewers.processViewerStats()
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
