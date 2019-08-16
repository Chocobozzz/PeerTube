import { logger } from '../../helpers/logger'
import { AbstractScheduler } from './abstract-scheduler'
import { ScheduleVideoUpdateModel } from '../../models/video/schedule-video-update'
import { retryTransactionWrapper } from '../../helpers/database-utils'
import { federateVideoIfNeeded } from '../activitypub'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants'
import { VideoPrivacy } from '../../../shared/models/videos'
import { Notifier } from '../notifier'
import { VideoModel } from '../../models/video/video'
import { sequelizeTypescript } from '../../initializers/database'

export class UpdateVideosScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.updateVideos

  private constructor () {
    super()
  }

  protected async internalExecute () {
    return retryTransactionWrapper(this.updateVideos.bind(this))
  }

  private async updateVideos () {
    if (!await ScheduleVideoUpdateModel.areVideosToUpdate()) return undefined

    const publishedVideos = await sequelizeTypescript.transaction(async t => {
      const schedules = await ScheduleVideoUpdateModel.listVideosToUpdate(t)
      const publishedVideos: VideoModel[] = []

      for (const schedule of schedules) {
        const video = schedule.Video
        logger.info('Executing scheduled video update on %s.', video.uuid)

        if (schedule.privacy) {
          const oldPrivacy = video.privacy
          const isNewVideo = oldPrivacy === VideoPrivacy.PRIVATE

          video.privacy = schedule.privacy
          if (isNewVideo === true) video.publishedAt = new Date()

          await video.save({ transaction: t })
          await federateVideoIfNeeded(video, isNewVideo, t)

          if (oldPrivacy === VideoPrivacy.UNLISTED || oldPrivacy === VideoPrivacy.PRIVATE) {
            video.ScheduleVideoUpdate = schedule
            publishedVideos.push(video)
          }
        }

        await schedule.destroy({ transaction: t })
      }

      return publishedVideos
    })

    for (const v of publishedVideos) {
      Notifier.Instance.notifyOnNewVideoIfNeeded(v)
      Notifier.Instance.notifyOnVideoPublishedAfterScheduledUpdate(v)
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
