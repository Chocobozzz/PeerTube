import {
  RunnerJobVODAudioMergeTranscodingPrivatePayload,
  RunnerJobVODWebVideoTranscodingPrivatePayload,
  VideoFileStreamType
} from '@peertube/peertube-models'
import { logger, LoggerTagsFn } from '@server/helpers/logger.js'
import { onTranscodingEnded } from '@server/lib/transcoding/ended-transcoding.js'
import { onWebVideoFileTranscoding } from '@server/lib/transcoding/web-transcoding.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoFull } from '@server/types/models/index.js'
import { MRunnerJob } from '@server/types/models/runners/index.js'

export async function onVODWebVideoOrAudioMergeTranscodingJob (options: {
  video: MVideoFull
  videoFilePath: string
  privatePayload: RunnerJobVODWebVideoTranscodingPrivatePayload | RunnerJobVODAudioMergeTranscodingPrivatePayload
  wasAudioFile: boolean
}) {
  const { video, videoFilePath, privatePayload, wasAudioFile } = options

  const deleteWebInputVideoFile = privatePayload.deleteInputFileId
    ? video.VideoFiles.find(f => f.id === privatePayload.deleteInputFileId)
    : undefined

  await onWebVideoFileTranscoding({ video, videoOutputPath: videoFilePath, deleteWebInputVideoFile, wasAudioFile })

  await onTranscodingEnded({ isNewVideo: privatePayload.isNewVideo, moveVideoToNextState: privatePayload.canMoveVideoState, video })
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

export async function hasMissingHLSStreams (options: {
  inputStreams: VideoFileStreamType[]
  transcodingRequestAt: string
  videoId: string | number
}) {
  const { videoId, inputStreams, transcodingRequestAt } = options

  const video = await VideoModel.loadFull(videoId)
  const hlsFiles = video.getHLSPlaylist().VideoFiles

  for (const inputStream of inputStreams) {
    const hasStream = hlsFiles.some(f => {
      // Compare creation dates to avoid using files created before the root job (e.g., from a previous transcoding)
      return new Date(f.createdAt).getTime() >= new Date(transcodingRequestAt).getTime() &&
        (f.streams & inputStream)
    })

    if (!hasStream) return true
  }

  return false
}
