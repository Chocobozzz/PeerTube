import { VideoModel } from '@server/models/video/video'
import { MVideoFullLight } from '@server/types/models'
import { logger } from '../../helpers/logger'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants'
import { sequelizeTypescript } from '../../initializers/database'
import { ScheduleVideoUpdateModel } from '../../models/video/schedule-video-update'
import { federateVideoIfNeeded } from '../activitypub/videos'
import { Notifier } from '../notifier'
import { AbstractScheduler } from './abstract-scheduler'

export class UpdateVideosScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.updateVideos

  private constructor () {
    super()
  }

  protected async internalExecute () {
    return this.updateVideos()
  }

  private async updateVideos () {
    if (!await ScheduleVideoUpdateModel.areVideosToUpdate()) return undefined

    const schedules = await ScheduleVideoUpdateModel.listVideosToUpdate()
    const publishedVideos: MVideoFullLight[] = []

    for (const schedule of schedules) {
      await sequelizeTypescript.transaction(async t => {
        const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(schedule.videoId, t)

        logger.info('Executing scheduled video update on %s.', video.uuid)

        if (schedule.privacy) {
          const wasConfidentialVideo = video.isConfidential()
          const isNewVideo = video.isNewVideo(schedule.privacy)

          video.setPrivacy(schedule.privacy)
          await video.save({ transaction: t })
          await federateVideoIfNeeded(video, isNewVideo, t)

          if (wasConfidentialVideo) {
            publishedVideos.push(video)
          }
        }

        await schedule.destroy({ transaction: t })
      })
    }

    for (const v of publishedVideos) {
      Notifier.Instance.notifyOnNewVideoIfNeeded(v)
      Notifier.Instance.notifyOnVideoPublishedAfterScheduledUpdate(v)
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
