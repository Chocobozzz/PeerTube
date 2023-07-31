import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { sendView } from '@server/lib/activitypub/send/send-view.js'
import { getCachedVideoDuration } from '@server/lib/video.js'
import { getServerActor } from '@server/models/application/application.js'
import { MVideo, MVideoImmutable } from '@server/types/models/index.js'
import { buildUUID } from '@peertube/peertube-node-utils'
import { Redis } from '../../redis.js'

const lTags = loggerTagsFactory('views')

export class VideoViews {

  async addLocalView (options: {
    video: MVideoImmutable
    ip: string
    watchTime: number
  }) {
    const { video, ip, watchTime } = options

    logger.debug('Adding local view to video %s.', video.uuid, { watchTime, ...lTags(video.uuid) })

    if (!await this.hasEnoughWatchTime(video, watchTime)) return false

    const viewExists = await Redis.Instance.doesVideoIPViewExist(ip, video.uuid)
    if (viewExists) return false

    await Redis.Instance.setIPVideoView(ip, video.uuid)

    await this.addView(video)

    await sendView({ byActor: await getServerActor(), video, type: 'view', viewerIdentifier: buildUUID() })

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

    if (isLive || duration >= 30) return watchTime >= 30

    // Check more than 50% of the video is watched
    return duration / watchTime < 2
  }
}
