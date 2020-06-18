import { logger } from '../../helpers/logger'
import { AbstractScheduler } from './abstract-scheduler'
import { ScheduleVideoUpdateModel } from '../../models/video/schedule-video-update'
import { retryTransactionWrapper } from '../../helpers/database-utils'
import { federateVideoIfNeeded } from '../activitypub/videos'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants'
import { Notifier } from '../notifier'
import { sequelizeTypescript } from '../../initializers/database'
import { MVideoFullLight } from '@server/types/models'

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
      const publishedVideos: MVideoFullLight[] = []

      for (const schedule of schedules) {
        const video = schedule.Video
        logger.info('Executing scheduled video update on %s.', video.uuid)

        if (schedule.privacy) {
          const wasConfidentialVideo = video.isConfidential()
          const isNewVideo = video.isNewVideo(schedule.privacy)

          video.setPrivacy(schedule.privacy)
          await video.save({ transaction: t })
          await federateVideoIfNeeded(video, isNewVideo, t)

          if (wasConfidentialVideo) {
            const videoToPublish: MVideoFullLight = Object.assign(video, { ScheduleVideoUpdate: schedule, UserVideoHistories: [] })
            publishedVideos.push(videoToPublish)
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
