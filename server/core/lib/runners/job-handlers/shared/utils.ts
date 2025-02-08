import {
  RunnerJobVODAudioMergeTranscodingPrivatePayload,
  RunnerJobVODWebVideoTranscodingPrivatePayload,
  VideoResolution
} from '@peertube/peertube-models'
import { logger, LoggerTagsFn } from '@server/helpers/logger.js'
import { onTranscodingEnded } from '@server/lib/transcoding/ended-transcoding.js'
import { onWebVideoFileTranscoding } from '@server/lib/transcoding/web-transcoding.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoFullLight } from '@server/types/models/index.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'

export async function onVODWebVideoOrAudioMergeTranscodingJob (options: {
  video: MVideoFullLight
  videoFilePath: string
  privatePayload: RunnerJobVODWebVideoTranscodingPrivatePayload | RunnerJobVODAudioMergeTranscodingPrivatePayload
  wasAudioFile: boolean
}) {
  const { video, videoFilePath, privatePayload, wasAudioFile } = options

  const deleteWebInputVideoFile = privatePayload.deleteInputFileId
    ? video.VideoFiles.find(f => f.id === privatePayload.deleteInputFileId)
    : undefined

  await onWebVideoFileTranscoding({ video, videoOutputPath: videoFilePath, deleteWebInputVideoFile, wasAudioFile })

  await onTranscodingEnded({ isNewVideo: privatePayload.isNewVideo, moveVideoToNextState: true, video })
}

export async function loadRunnerVideo (runnerJob: MRunnerJob, lTags: LoggerTagsFn) {
  const videoUUID = runnerJob.privatePayload.videoUUID

  const video = await VideoModel.loadFull(videoUUID)
  if (!video) {
    logger.info('Video %s does not exist anymore after runner job.', videoUUID, lTags(videoUUID))
    return undefined
  }

  return video
}

export async function isVideoMissHLSAudio (options: {
  resolution: number
  separatedAudio: boolean
  videoId: string | number
}) {
  if (!options.separatedAudio) return false

  if (options.resolution !== VideoResolution.H_NOVIDEO) {
    const video = await VideoModel.loadFull(options.videoId)

    // Video doesn't have audio file yet
    if (video.hasAudio() !== true) return true
  }

  return false
}
