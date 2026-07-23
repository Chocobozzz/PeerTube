import { VideoPrivacy, VideoPrivacyType, VideoState } from '@peertube/peertube-models'
import { VideoModel } from '@server/models/video/video.js'
import { MScheduleVideoUpdate } from '@server/types/models/index.js'
import { logger, loggerTagsFactory } from '../../helpers/logger.js'
import { SCHEDULER_INTERVALS_MS } from '../../initializers/constants.js'
import { ScheduleVideoUpdateModel } from '../../models/video/schedule-video-update.js'
import { LocalVideoUpdater } from '../local-video-updater.js'
import { Notifier } from '../notifier/index.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const lTags = loggerTagsFactory('schedulers', 'update-videos')

export class UpdateVideosScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = SCHEDULER_INTERVALS_MS.UPDATE_VIDEOS

  private constructor () {
    super({ randomRunOnEnable: false })
  }

  protected async internalExecute () {
    return this.updateVideos()
  }

  private async updateVideos () {
    logger.debug('Running update videos scheduler', lTags())

    if (!await ScheduleVideoUpdateModel.areVideosToUpdate()) return undefined

    const schedules = await ScheduleVideoUpdateModel.listVideosToUpdate()

    for (const schedule of schedules) {
      const videoOnly = await VideoModel.load(schedule.videoId)
      if (!videoOnly) continue

      try {
        const { video, published } = await this.updateAVideo(schedule)

        if (published) Notifier.Instance.notifyOnVideoPublishedAfterScheduledUpdate(video)
      } catch (err) {
        logger.error('Cannot update video ' + videoOnly.uuid, { err, ...lTags(videoOnly.uuid) })
      }
    }
  }

  private async updateAVideo (schedule: MScheduleVideoUpdate) {
    let oldPrivacy: VideoPrivacyType
    let published = false

    let video = await VideoModel.loadFull(schedule.videoId)
    if (video.state === VideoState.TO_TRANSCODE) return { video, published: false }

    logger.info('Executing scheduled video update on ' + video.uuid, lTags(video.uuid))

    if (schedule.privacy) {
      oldPrivacy = video.privacy

      const updater = new LocalVideoUpdater({ user: null, tags: lTags().tags, video })

      video = await updater.update({ privacy: schedule.privacy })

      if (oldPrivacy === VideoPrivacy.PRIVATE) {
        published = true
      }
    }

    await schedule.destroy()

    return { video, published }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
