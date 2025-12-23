import { pick } from '@peertube/peertube-core-utils'
import { TranscodingJobBuilderPayload, VideoFileStream } from '@peertube/peertube-models'
import { createOptimizeOrMergeAudioJobs } from '@server/lib/transcoding/create-transcoding-job.js'
import { UserModel } from '@server/models/user/user.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { VideoModel } from '@server/models/video/video.js'
import { Job } from 'bullmq'
import { logger } from '../../../helpers/logger.js'
import { JobQueue } from '../job-queue.js'

async function processTranscodingJobBuilder (job: Job) {
  const payload = job.data as TranscodingJobBuilderPayload

  logger.info('Processing transcoding job builder in job %s.', job.id)

  if (payload.optimizeJob) {
    const video = await VideoModel.loadFull(payload.videoUUID)
    const user = await UserModel.loadByVideoId(video.id)
    const videoFile = video.getMaxQualityFile(VideoFileStream.VIDEO) || video.getMaxQualityFile(VideoFileStream.AUDIO)

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
