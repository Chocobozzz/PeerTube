import { move } from 'fs-extra/esm'
import { dirname, join } from 'path'
import { logger, LoggerTagsFn } from '@server/helpers/logger.js'
import { onTranscodingEnded } from '@server/lib/transcoding/ended-transcoding.js'
import { onWebVideoFileTranscoding } from '@server/lib/transcoding/web-transcoding.js'
import { buildNewFile } from '@server/lib/video-file.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoFullLight } from '@server/types/models/index.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'
import { RunnerJobVODAudioMergeTranscodingPrivatePayload, RunnerJobVODWebVideoTranscodingPrivatePayload } from '@peertube/peertube-models'

export async function onVODWebVideoOrAudioMergeTranscodingJob (options: {
  video: MVideoFullLight
  videoFilePath: string
  privatePayload: RunnerJobVODWebVideoTranscodingPrivatePayload | RunnerJobVODAudioMergeTranscodingPrivatePayload
}) {
  const { video, videoFilePath, privatePayload } = options

  const videoFile = await buildNewFile({ path: videoFilePath, mode: 'web-video' })
  videoFile.videoId = video.id

  const newVideoFilePath = join(dirname(videoFilePath), videoFile.filename)
  await move(videoFilePath, newVideoFilePath)

  await onWebVideoFileTranscoding({
    video,
    videoFile,
    videoOutputPath: newVideoFilePath
  })

  await onTranscodingEnded({ isNewVideo: privatePayload.isNewVideo, moveVideoToNextState: true, video })
}

export async function loadTranscodingRunnerVideo (runnerJob: MRunnerJob, lTags: LoggerTagsFn) {
  const videoUUID = runnerJob.privatePayload.videoUUID

  const video = await VideoModel.loadFull(videoUUID)
  if (!video) {
    logger.info('Video %s does not exist anymore after transcoding runner job.', videoUUID, lTags(videoUUID))
    return undefined
  }

  return video
}
