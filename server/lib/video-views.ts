import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { VIEW_LIFETIME } from '@server/initializers/constants'
import { VideoModel } from '@server/models/video/video'
import { MVideo } from '@server/types/models'
import { PeerTubeSocket } from './peertube-socket'
import { Redis } from './redis'

const lTags = loggerTagsFactory('views')

export class VideoViews {

  // Values are Date().getTime()
  private readonly viewersPerVideo = new Map<number, number[]>()

  private static instance: VideoViews

  private constructor () {
  }

  init () {
    setInterval(() => this.cleanViewers(), VIEW_LIFETIME.VIEWER)
  }

  async processView (options: {
    video: MVideo
    ip: string | null
    viewerExpires?: Date
  }) {
    const { video, ip, viewerExpires } = options

    logger.debug('Processing view for %s and ip %s.', video.url, ip, lTags())

    let success = await this.addView(video, ip)

    if (video.isLive) {
      const successViewer = await this.addViewer(video, ip, viewerExpires)
      success ||= successViewer
    }

    return success
  }

  getViewers (video: MVideo) {
    const viewers = this.viewersPerVideo.get(video.id)
    if (!viewers) return 0

    return viewers.length
  }

  buildViewerExpireTime () {
    return new Date().getTime() + VIEW_LIFETIME.VIEWER
  }

  private async addView (video: MVideo, ip: string | null) {
    const promises: Promise<any>[] = []

    if (ip !== null) {
      const viewExists = await Redis.Instance.doesVideoIPViewExist(ip, video.uuid)
      if (viewExists) return false

      promises.push(Redis.Instance.setIPVideoView(ip, video.uuid))
    }

    if (video.isOwned()) {
      promises.push(Redis.Instance.addLocalVideoView(video.id))
    }

    promises.push(Redis.Instance.addVideoViewStats(video.id))

    await Promise.all(promises)

    return true
  }

  private async addViewer (video: MVideo, ip: string | null, viewerExpires?: Date) {
    if (ip !== null) {
      const viewExists = await Redis.Instance.doesVideoIPViewerExist(ip, video.uuid)
      if (viewExists) return false

      await Redis.Instance.setIPVideoViewer(ip, video.uuid)
    }

    let watchers = this.viewersPerVideo.get(video.id)

    if (!watchers) {
      watchers = []
      this.viewersPerVideo.set(video.id, watchers)
    }

    const expiration = viewerExpires
      ? viewerExpires.getTime()
      : this.buildViewerExpireTime()

    watchers.push(expiration)
    await this.notifyClients(video.id, watchers.length)

    return true
  }

  private async cleanViewers () {
    logger.info('Cleaning video viewers.', lTags())

    for (const videoId of this.viewersPerVideo.keys()) {
      const notBefore = new Date().getTime()

      const viewers = this.viewersPerVideo.get(videoId)

      // Only keep not expired viewers
      const newViewers = viewers.filter(w => w > notBefore)

      if (newViewers.length === 0) this.viewersPerVideo.delete(videoId)
      else this.viewersPerVideo.set(videoId, newViewers)

      await this.notifyClients(videoId, newViewers.length)
    }
  }

  private async notifyClients (videoId: string | number, viewersLength: number) {
    const video = await VideoModel.loadImmutableAttributes(videoId)
    if (!video) return

    PeerTubeSocket.Instance.sendVideoViewsUpdate(video, viewersLength)

    logger.debug('Live video views update for %s is %d.', video.url, viewersLength, lTags())
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
