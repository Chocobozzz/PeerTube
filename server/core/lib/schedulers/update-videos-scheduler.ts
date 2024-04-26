import { VideoPrivacy, VideoPrivacyType, VideoState } from '@peertube/peertube-models'
import { VideoModel } from '@server/models/video/video.js'
import { MScheduleVideoUpdate } from '@server/types/models/index.js'
import { logger } from '../../helpers/logger.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { sequelizeTypescript } from '../../initializers/database.js'
import { ScheduleVideoUpdateModel } from '../../models/video/schedule-video-update.js'
import { isNewVideoPrivacyForFederation } from '../activitypub/videos/federate.js'
import { Notifier } from '../notifier/index.js'
import { addVideoJobsAfterUpdate } from '../video-jobs.js'
import { VideoPathManager } from '../video-path-manager.js'
import { setVideoPrivacy } from '../video-privacy.js'
import { AbstractScheduler } from './abstract-scheduler.js'

export class UpdateVideosScheduler extends AbstractScheduler {

  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.UPDATE_VIDEOS

  private constructor () {
    super()
  }

  protected async internalExecute () {
    return this.updateVideos()
  }

  private async updateVideos () {
    if (!await ScheduleVideoUpdateModel.areVideosToUpdate()) return undefined

    const schedules = await ScheduleVideoUpdateModel.listVideosToUpdate()

    for (const schedule of schedules) {
      const videoOnly = await VideoModel.load(schedule.videoId)
      const mutexReleaser = await VideoPathManager.Instance.lockFiles(videoOnly.uuid)

      try {
        const { video, published } = await this.updateAVideo(schedule)

        if (published) Notifier.Instance.notifyOnVideoPublishedAfterScheduledUpdate(video)
      } catch (err) {
        logger.error('Cannot update video', { err })
      }

      mutexReleaser()
    }
  }

  private async updateAVideo (schedule: MScheduleVideoUpdate) {
    let oldPrivacy: VideoPrivacyType
    let isNewVideoForFederation: boolean
    let published = false

    const video = await sequelizeTypescript.transaction(async t => {
      const video = await VideoModel.loadFull(schedule.videoId, t)
      if (video.state === VideoState.TO_TRANSCODE) return null

      logger.info('Executing scheduled video update on %s.', video.uuid)

      if (schedule.privacy) {
        isNewVideoForFederation = isNewVideoPrivacyForFederation(video.privacy, schedule.privacy)
        oldPrivacy = video.privacy

        setVideoPrivacy(video, schedule.privacy)
        await video.save({ transaction: t })

        if (oldPrivacy === VideoPrivacy.PRIVATE) {
          published = true
        }
      }

      await schedule.destroy({ transaction: t })

      return video
    })

    if (!video) {
      return { video, published: false }
    }

    await addVideoJobsAfterUpdate({ video, oldPrivacy, isNewVideoForFederation, nameChanged: false })

    return { video, published }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
