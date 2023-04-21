import { move } from 'fs-extra'
import { dirname, join } from 'path'
import { logger, LoggerTagsFn } from '@server/helpers/logger'
import { onTranscodingEnded } from '@server/lib/transcoding/ended-transcoding'
import { onWebTorrentVideoFileTranscoding } from '@server/lib/transcoding/web-transcoding'
import { buildNewFile } from '@server/lib/video-file'
import { VideoModel } from '@server/models/video/video'
import { MVideoFullLight } from '@server/types/models'
import { MRunnerJob } from '@server/types/models/runners'
import { RunnerJobVODAudioMergeTranscodingPrivatePayload, RunnerJobVODWebVideoTranscodingPrivatePayload } from '@shared/models'

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

  await onWebTorrentVideoFileTranscoding({
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
