import { logger } from '../../helpers/logger'
import { AbstractScheduler } from './abstract-scheduler'
import { ScheduleVideoUpdateModel } from '../../models/video/schedule-video-update'
import { retryTransactionWrapper } from '../../helpers/database-utils'
import { federateVideoIfNeeded } from '../activitypub'
import { SCHEDULER_INTERVALS_MS, sequelizeTypescript } from '../../initializers'
import { VideoPrivacy } from '../../../shared/models/videos'

export class UpdateVideosScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.updateVideos

  private isRunning = false

  private constructor () {
    super()
  }

  async execute () {
    if (this.isRunning === true) return
    this.isRunning = true

    try {
      await retryTransactionWrapper(this.updateVideos.bind(this))
    } catch (err) {
      logger.error('Cannot execute update videos scheduler.', { err })
    } finally {
      this.isRunning = false
    }
  }

  private async updateVideos () {
    if (!await ScheduleVideoUpdateModel.areVideosToUpdate()) return undefined

    return sequelizeTypescript.transaction(async t => {
      const schedules = await ScheduleVideoUpdateModel.listVideosToUpdate(t)

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
        }

        await schedule.destroy({ transaction: t })
      }
    })
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
