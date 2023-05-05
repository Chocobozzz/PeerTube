import { Job } from 'bullmq'
import { onTranscodingEnded } from '@server/lib/transcoding/ended-transcoding'
import { generateHlsPlaylistResolution } from '@server/lib/transcoding/hls-transcoding'
import { mergeAudioVideofile, optimizeOriginalVideofile, transcodeNewWebTorrentResolution } from '@server/lib/transcoding/web-transcoding'
import { removeAllWebTorrentFiles } from '@server/lib/video-file'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { moveToFailedTranscodingState } from '@server/lib/video-state'
import { UserModel } from '@server/models/user/user'
import { VideoJobInfoModel } from '@server/models/video/video-job-info'
import { MUser, MUserId, MVideoFullLight } from '@server/types/models'
import {
  HLSTranscodingPayload,
  MergeAudioTranscodingPayload,
  NewWebTorrentResolutionTranscodingPayload,
  OptimizeTranscodingPayload,
  VideoTranscodingPayload
} from '@shared/models'
import { logger, loggerTagsFactory } from '../../../helpers/logger'
import { VideoModel } from '../../../models/video/video'

type HandlerFunction = (job: Job, payload: VideoTranscodingPayload, video: MVideoFullLight, user: MUser) => Promise<void>

const handlers: { [ id in VideoTranscodingPayload['type'] ]: HandlerFunction } = {
  'new-resolution-to-hls': handleHLSJob,
  'new-resolution-to-webtorrent': handleNewWebTorrentResolutionJob,
  'merge-audio-to-webtorrent': handleWebTorrentMergeAudioJob,
  'optimize-to-webtorrent': handleWebTorrentOptimizeJob
}

const lTags = loggerTagsFactory('transcoding')

async function processVideoTranscoding (job: Job) {
  const payload = job.data as VideoTranscodingPayload
  logger.info('Processing transcoding job %s.', job.id, lTags(payload.videoUUID))

  const video = await VideoModel.loadFull(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Do not process job %d, video does not exist.', job.id, lTags(payload.videoUUID))
    return undefined
  }

  const user = await UserModel.loadByChannelActorId(video.VideoChannel.actorId)

  const handler = handlers[payload.type]

  if (!handler) {
    await moveToFailedTranscodingState(video)
    await VideoJobInfoModel.decrease(video.uuid, 'pendingTranscode')

    throw new Error('Cannot find transcoding handler for ' + payload.type)
  }

  try {
    await handler(job, payload, video, user)
  } catch (error) {
    await moveToFailedTranscodingState(video)

    await VideoJobInfoModel.decrease(video.uuid, 'pendingTranscode')

    throw error
  }

  return video
}

// ---------------------------------------------------------------------------

export {
  processVideoTranscoding
}

// ---------------------------------------------------------------------------
// Job handlers
// ---------------------------------------------------------------------------

async function handleWebTorrentMergeAudioJob (job: Job, payload: MergeAudioTranscodingPayload, video: MVideoFullLight, user: MUserId) {
  logger.info('Handling merge audio transcoding job for %s.', video.uuid, lTags(video.uuid))

  await mergeAudioVideofile({ video, resolution: payload.resolution, fps: payload.fps, job })

  logger.info('Merge audio transcoding job for %s ended.', video.uuid, lTags(video.uuid))

  await onTranscodingEnded({ isNewVideo: payload.isNewVideo, moveVideoToNextState: !payload.hasChildren, video })
}

async function handleWebTorrentOptimizeJob (job: Job, payload: OptimizeTranscodingPayload, video: MVideoFullLight, user: MUserId) {
  logger.info('Handling optimize transcoding job for %s.', video.uuid, lTags(video.uuid))

  await optimizeOriginalVideofile({ video, inputVideoFile: video.getMaxQualityFile(), quickTranscode: payload.quickTranscode, job })

  logger.info('Optimize transcoding job for %s ended.', video.uuid, lTags(video.uuid))

  await onTranscodingEnded({ isNewVideo: payload.isNewVideo, moveVideoToNextState: !payload.hasChildren, video })
}

// ---------------------------------------------------------------------------

async function handleNewWebTorrentResolutionJob (job: Job, payload: NewWebTorrentResolutionTranscodingPayload, video: MVideoFullLight) {
  logger.info('Handling WebTorrent transcoding job for %s.', video.uuid, lTags(video.uuid))

  await transcodeNewWebTorrentResolution({ video, resolution: payload.resolution, fps: payload.fps, job })

  logger.info('WebTorrent transcoding job for %s ended.', video.uuid, lTags(video.uuid))

  await onTranscodingEnded({ isNewVideo: payload.isNewVideo, moveVideoToNextState: true, video })
}

// ---------------------------------------------------------------------------

async function handleHLSJob (job: Job, payload: HLSTranscodingPayload, videoArg: MVideoFullLight) {
  logger.info('Handling HLS transcoding job for %s.', videoArg.uuid, lTags(videoArg.uuid))

  const inputFileMutexReleaser = await VideoPathManager.Instance.lockFiles(videoArg.uuid)
  let video: MVideoFullLight

  try {
    video = await VideoModel.loadFull(videoArg.uuid)

    const videoFileInput = payload.copyCodecs
      ? video.getWebTorrentFile(payload.resolution)
      : video.getMaxQualityFile()

    const videoOrStreamingPlaylist = videoFileInput.getVideoOrStreamingPlaylist()

    await VideoPathManager.Instance.makeAvailableVideoFile(videoFileInput.withVideoOrPlaylist(videoOrStreamingPlaylist), videoInputPath => {
      return generateHlsPlaylistResolution({
        video,
        videoInputPath,
        inputFileMutexReleaser,
        resolution: payload.resolution,
        fps: payload.fps,
        copyCodecs: payload.copyCodecs,
        job
      })
    })
  } finally {
    inputFileMutexReleaser()
  }

  logger.info('HLS transcoding job for %s ended.', video.uuid, lTags(video.uuid))

  if (payload.deleteWebTorrentFiles === true) {
    logger.info('Removing WebTorrent files of %s now we have a HLS version of it.', video.uuid, lTags(video.uuid))

    await removeAllWebTorrentFiles(video)
  }

  await onTranscodingEnded({ isNewVideo: payload.isNewVideo, moveVideoToNextState: true, video })
}
