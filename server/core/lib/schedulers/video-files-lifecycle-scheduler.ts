import { VideoLifecyclePolicy } from '@peertube/peertube-models'
import { createLogger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { JobQueue } from '../job-queue/job-queue.js'
import { checkPolicyDatabaseState, listVideosToProcess } from '../video-files-lifecycle/index.js'
import { AbstractScheduler } from './abstract-scheduler.js'

const logger = createLogger('schedulers', 'video-files-lifecycle')

type VideoToProcess = { id: number, uuid: string }

export class VideoFilesLifecycleScheduler extends AbstractScheduler {
  private static instance: AbstractScheduler

  protected schedulerIntervalMs = CONFIG.VIDEO_FILE.LIFECYCLE.CHECK_INTERVAL

  private constructor () {
    super({ randomRunOnEnable: true })
  }

  protected async internalExecute () {
    const lifecycle = CONFIG.VIDEO_FILE.LIFECYCLE
    if (lifecycle.ENABLED !== true) return

    const policies = lifecycle.POLICIES
    if (policies.length === 0) return

    logger.info(
      `Running video files lifecycle scheduler on ${policies.length} policies.` +
        (lifecycle.DRY_RUN ? ' Dry run is enabled so no file will be deleted.' : '')
    )

    // A video is processed by the first policy that matches it
    const alreadySelected = new Set<number>()
    let remaining = lifecycle.MAX_VIDEOS_PER_RUN

    for (const policy of policies) {
      if (remaining <= 0) {
        logger.info(
          `Reached the maximum of ${lifecycle.MAX_VIDEOS_PER_RUN} videos to process in one run. ` +
            `Other videos files of lifecycle policy "${policy.name}" are postponed to the next run.`
        )
        break
      }

      try {
        await checkPolicyDatabaseState(policy)

        // The SQL query already limits the result to the remaining budget
        const videos = (await listVideosToProcess({ policy, limit: remaining }))
          .filter(v => !alreadySelected.has(v.id))

        for (const video of videos) alreadySelected.add(video.id)
        remaining -= videos.length

        if (videos.length === 0) {
          logger.debug(`No video to process for video files lifecycle policy "${policy.name}".`)
          continue
        }

        await this.createJobs(policy, videos)
      } catch (err) {
        logger.error(`Cannot run video files lifecycle policy "${policy.name}".`, { err })
      }
    }
  }

  private async createJobs (policy: VideoLifecyclePolicy, videos: VideoToProcess[]) {
    for (const video of videos) {
      await JobQueue.Instance.createJob({
        type: 'video-files-lifecycle',
        payload: { videoUUID: video.uuid, policyName: policy.name },

        // A job of a previous run may still be pending for this video: in that case the video is already scheduled
        deduplicationId: `video-files-lifecycle-${video.uuid}`
      })
    }

    logger.info(`Scheduled ${videos.length} videos to process for video files lifecycle policy "${policy.name}".`)
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}
