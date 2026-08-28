import { VideoFilesLifecyclePayload } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import {
  applyVideoFilesLifecyclePolicy,
  doesVideoStillMatchPolicy,
  getVideoFilesLifecyclePolicy
} from '@server/lib/video-files-lifecycle/index.js'
import { VideoModel } from '@server/models/video/video.js'
import { Job } from 'bullmq'

const logger = createLogger('video-files-lifecycle')

export async function processVideoFilesLifecycle (job: Job) {
  const payload = job.data as VideoFilesLifecyclePayload

  await logger.withContext([ payload.videoUUID ], async () => {
    // The admin may have disabled the lifecycle or enabled the dry run since the scheduler created this job
    const lifecycle = CONFIG.VIDEO_FILE.LIFECYCLE

    if (lifecycle.ENABLED !== true) {
      logger.info(`Video files lifecycle is disabled, skipping job ${job.id}.`)
      return
    }

    const policy = getVideoFilesLifecyclePolicy(payload.policyName)
    if (!policy) {
      logger.info(`Video files lifecycle policy "${payload.policyName}" does not exist anymore, skipping job ${job.id}.`)
      return
    }

    const video = await VideoModel.loadFull(payload.videoUUID)
    if (!video) {
      logger.debug(`Video ${payload.videoUUID} does not exist anymore, skipping video files lifecycle job ${job.id}.`)
      return
    }

    // The video may have been viewed, transcoded, moved or blacklisted since the scheduler selected it
    if (await doesVideoStillMatchPolicy({ policy, videoId: video.id }) !== true) {
      logger.info(`Video ${payload.videoUUID} does not match "${policy.name}" policy anymore, skipping job ${job.id}.`)
      return
    }

    await applyVideoFilesLifecyclePolicy({ policy, video, dryRun: lifecycle.DRY_RUN })
  })
}
