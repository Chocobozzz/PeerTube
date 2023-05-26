import { Job } from 'bullmq'
import { createOptimizeOrMergeAudioJobs } from '@server/lib/transcoding/create-transcoding-job'
import { UserModel } from '@server/models/user/user'
import { VideoModel } from '@server/models/video/video'
import { VideoJobInfoModel } from '@server/models/video/video-job-info'
import { pick } from '@shared/core-utils'
import { TranscodingJobBuilderPayload } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { JobQueue } from '../job-queue'

async function processTranscodingJobBuilder (job: Job) {
  const payload = job.data as TranscodingJobBuilderPayload

  logger.info('Processing transcoding job builder in job %s.', job.id)

  if (payload.optimizeJob) {
    const video = await VideoModel.loadFull(payload.videoUUID)
    const user = await UserModel.loadByVideoId(video.id)
    const videoFile = video.getMaxQualityFile()

    await createOptimizeOrMergeAudioJobs({
      ...pick(payload.optimizeJob, [ 'isNewVideo' ]),

      video,
      videoFile,
      user,
      videoFileAlreadyLocked: false
    })
  }

  for (const job of (payload.jobs || [])) {
    await JobQueue.Instance.createJob(job)

    await VideoJobInfoModel.increaseOrCreate(payload.videoUUID, 'pendingTranscode')
  }

  for (const sequentialJobs of (payload.sequentialJobs || [])) {
    await JobQueue.Instance.createSequentialJobFlow(...sequentialJobs)

    await VideoJobInfoModel.increaseOrCreate(payload.videoUUID, 'pendingTranscode', sequentialJobs.filter(s => !!s).length)
  }
}

// ---------------------------------------------------------------------------

export {
  processTranscodingJobBuilder
}
