import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { MVideo } from '@server/types/models'
import { Redis } from '../../redis'

const lTags = loggerTagsFactory('views')

export class VideoViews {

  async addLocalView (options: {
    video: MVideo
    ip: string
    watchTime: number
  }) {
    const { video, ip, watchTime } = options

    logger.debug('Adding local view to video %s.', video.uuid, { watchTime, ...lTags(video.uuid) })

    if (!this.hasEnoughWatchTime(video, watchTime)) return false

    const viewExists = await Redis.Instance.doesVideoIPViewExist(ip, video.uuid)
    if (viewExists) return false

    await Redis.Instance.setIPVideoView(ip, video.uuid)

    await this.addView(video)

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

  private async addView (video: MVideo) {
    const promises: Promise<any>[] = []

    if (video.isOwned()) {
      promises.push(Redis.Instance.addLocalVideoView(video.id))
    }

    promises.push(Redis.Instance.addVideoViewStats(video.id))

    await Promise.all(promises)
  }

  private hasEnoughWatchTime (video: MVideo, watchTime: number) {
    if (video.isLive || video.duration >= 30) return watchTime >= 30

    // Check more than 50% of the video is watched
    return video.duration / watchTime < 2
  }
}
