import * as Bull from 'bull'
import { publishAndFederateIfNeeded } from '@server/lib/video'
import { getVideoFilePath } from '@server/lib/video-paths'
import { MVideoFullLight, MVideoUUID, MVideoWithFile } from '@server/types/models'
import {
  MergeAudioTranscodingPayload,
  NewResolutionTranscodingPayload,
  OptimizeTranscodingPayload,
  VideoTranscodingPayload
} from '../../../../shared'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { computeResolutionsToTranscode } from '../../../helpers/ffprobe-utils'
import { logger } from '../../../helpers/logger'
import { CONFIG } from '../../../initializers/config'
import { sequelizeTypescript } from '../../../initializers/database'
import { VideoModel } from '../../../models/video/video'
import { federateVideoIfNeeded } from '../../activitypub/videos'
import { Notifier } from '../../notifier'
import { generateHlsPlaylist, mergeAudioVideofile, optimizeOriginalVideofile, transcodeNewResolution } from '../../video-transcoding'
import { JobQueue } from '../job-queue'
import { TranscodeOptionsType } from '@server/helpers/ffmpeg-utils'

async function processVideoTranscoding (job: Bull.Job) {
  const payload = job.data as VideoTranscodingPayload
  logger.info('Processing video file in job %d.', job.id)

  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Do not process job %d, video does not exist.', job.id)
    return undefined
  }

  if (payload.type === 'hls') {
    const videoFileInput = payload.copyCodecs
      ? video.getWebTorrentFile(payload.resolution)
      : video.getMaxQualityFile()

    const videoOrStreamingPlaylist = videoFileInput.getVideoOrStreamingPlaylist()
    const videoInputPath = getVideoFilePath(videoOrStreamingPlaylist, videoFileInput)

    await generateHlsPlaylist({
      video,
      videoInputPath,
      resolution: payload.resolution,
      copyCodecs: payload.copyCodecs,
      isPortraitMode: payload.isPortraitMode || false
    })

    await retryTransactionWrapper(onHlsPlaylistGenerationSuccess, video)
  } else if (payload.type === 'new-resolution') {
    await transcodeNewResolution(video, payload.resolution, payload.isPortraitMode || false)

    await retryTransactionWrapper(publishNewResolutionIfNeeded, video, payload)
  } else if (payload.type === 'merge-audio') {
    await mergeAudioVideofile(video, payload.resolution)

    await retryTransactionWrapper(publishNewResolutionIfNeeded, video, payload)
  } else {
    const transcodeType = await optimizeOriginalVideofile(video)

    await retryTransactionWrapper(onVideoFileOptimizerSuccess, video, payload, transcodeType)
  }

  return video
}

async function onHlsPlaylistGenerationSuccess (video: MVideoFullLight) {
  if (video === undefined) return undefined

  // We generated the HLS playlist, we don't need the webtorrent files anymore if the admin disabled it
  if (CONFIG.TRANSCODING.WEBTORRENT.ENABLED === false) {
    for (const file of video.VideoFiles) {
      await video.removeFile(file)
      await file.destroy()
    }

    video.VideoFiles = []
  }

  return publishAndFederateIfNeeded(video)
}

async function publishNewResolutionIfNeeded (video: MVideoUUID, payload?: NewResolutionTranscodingPayload | MergeAudioTranscodingPayload) {
  await publishAndFederateIfNeeded(video)

  createHlsJobIfEnabled(Object.assign({}, payload, { copyCodecs: true }))
}

async function onVideoFileOptimizerSuccess (
  videoArg: MVideoWithFile,
  payload: OptimizeTranscodingPayload,
  transcodeType: TranscodeOptionsType
) {
  if (videoArg === undefined) return undefined

  // Outside the transaction (IO on disk)
  const { videoFileResolution, isPortraitMode } = await videoArg.getMaxQualityResolution()

  const { videoDatabase, videoPublished } = await sequelizeTypescript.transaction(async t => {
    // Maybe the video changed in database, refresh it
    const videoDatabase = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoArg.uuid, t)
    // Video does not exist anymore
    if (!videoDatabase) return undefined

    // Create transcoding jobs if there are enabled resolutions
    const resolutionsEnabled = computeResolutionsToTranscode(videoFileResolution, 'vod')
    logger.info(
      'Resolutions computed for video %s and origin file resolution of %d.', videoDatabase.uuid, videoFileResolution,
      { resolutions: resolutionsEnabled }
    )

    let videoPublished = false

    // Generate HLS version of the max quality file
    const originalFileHLSPayload = Object.assign({}, payload, {
      isPortraitMode,
      resolution: videoDatabase.getMaxQualityFile().resolution,
      // If we quick transcoded original file, force transcoding for HLS to avoid some weird playback issues
      copyCodecs: transcodeType !== 'quick-transcode'
    })
    createHlsJobIfEnabled(originalFileHLSPayload)

    if (resolutionsEnabled.length !== 0) {
      for (const resolution of resolutionsEnabled) {
        let dataInput: VideoTranscodingPayload

        if (CONFIG.TRANSCODING.WEBTORRENT.ENABLED) {
          dataInput = {
            type: 'new-resolution' as 'new-resolution',
            videoUUID: videoDatabase.uuid,
            resolution,
            isPortraitMode
          }
        } else if (CONFIG.TRANSCODING.HLS.ENABLED) {
          dataInput = {
            type: 'hls',
            videoUUID: videoDatabase.uuid,
            resolution,
            isPortraitMode,
            copyCodecs: false
          }
        }

        JobQueue.Instance.createJob({ type: 'video-transcoding', payload: dataInput })
      }

      logger.info('Transcoding jobs created for uuid %s.', videoDatabase.uuid, { resolutionsEnabled })
    } else {
      // No transcoding to do, it's now published
      videoPublished = await videoDatabase.publishIfNeededAndSave(t)

      logger.info('No transcoding jobs created for video %s (no resolutions).', videoDatabase.uuid, { privacy: videoDatabase.privacy })
    }

    await federateVideoIfNeeded(videoDatabase, payload.isNewVideo, t)

    return { videoDatabase, videoPublished }
  })

  if (payload.isNewVideo) Notifier.Instance.notifyOnNewVideoIfNeeded(videoDatabase)
  if (videoPublished) Notifier.Instance.notifyOnVideoPublishedAfterTranscoding(videoDatabase)
}

// ---------------------------------------------------------------------------

export {
  processVideoTranscoding,
  publishNewResolutionIfNeeded
}

// ---------------------------------------------------------------------------

function createHlsJobIfEnabled (payload: { videoUUID: string, resolution: number, isPortraitMode?: boolean, copyCodecs: boolean }) {
  // Generate HLS playlist?
  if (payload && CONFIG.TRANSCODING.HLS.ENABLED) {
    const hlsTranscodingPayload = {
      type: 'hls' as 'hls',
      videoUUID: payload.videoUUID,
      resolution: payload.resolution,
      isPortraitMode: payload.isPortraitMode,
      copyCodecs: payload.copyCodecs
    }

    return JobQueue.Instance.createJob({ type: 'video-transcoding', payload: hlsTranscodingPayload })
  }
}
