import * as Bull from 'bull'
import {
  MergeAudioTranscodingPayload,
  NewResolutionTranscodingPayload,
  OptimizeTranscodingPayload,
  VideoTranscodingPayload
} from '../../../../shared'
import { logger } from '../../../helpers/logger'
import { VideoModel } from '../../../models/video/video'
import { JobQueue } from '../job-queue'
import { federateVideoIfNeeded } from '../../activitypub/videos'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { sequelizeTypescript } from '../../../initializers/database'
import { computeResolutionsToTranscode } from '../../../helpers/ffmpeg-utils'
import { generateHlsPlaylist, mergeAudioVideofile, optimizeOriginalVideofile, transcodeNewResolution } from '../../video-transcoding'
import { Notifier } from '../../notifier'
import { CONFIG } from '../../../initializers/config'
import { MVideoFullLight, MVideoUUID, MVideoWithFile } from '@server/types/models'

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
    await generateHlsPlaylist(video, payload.resolution, payload.copyCodecs, payload.isPortraitMode || false)

    await retryTransactionWrapper(onHlsPlaylistGenerationSuccess, video)
  } else if (payload.type === 'new-resolution') {
    await transcodeNewResolution(video, payload.resolution, payload.isPortraitMode || false)

    await retryTransactionWrapper(publishNewResolutionIfNeeded, video, payload)
  } else if (payload.type === 'merge-audio') {
    await mergeAudioVideofile(video, payload.resolution)

    await retryTransactionWrapper(publishNewResolutionIfNeeded, video, payload)
  } else {
    await optimizeOriginalVideofile(video)

    await retryTransactionWrapper(onVideoFileOptimizerSuccess, video, payload)
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

  await createHlsJobIfEnabled(payload)
}

async function onVideoFileOptimizerSuccess (videoArg: MVideoWithFile, payload: OptimizeTranscodingPayload) {
  if (videoArg === undefined) return undefined

  // Outside the transaction (IO on disk)
  const { videoFileResolution, isPortraitMode } = await videoArg.getMaxQualityResolution()

  const { videoDatabase, videoPublished } = await sequelizeTypescript.transaction(async t => {
    // Maybe the video changed in database, refresh it
    const videoDatabase = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoArg.uuid, t)
    // Video does not exist anymore
    if (!videoDatabase) return undefined

    // Create transcoding jobs if there are enabled resolutions
    const resolutionsEnabled = computeResolutionsToTranscode(videoFileResolution)
    logger.info(
      'Resolutions computed for video %s and origin file resolution of %d.', videoDatabase.uuid, videoFileResolution,
      { resolutions: resolutionsEnabled }
    )

    let videoPublished = false

    // Generate HLS version of the max quality file
    const hlsPayload = Object.assign({}, payload, { resolution: videoDatabase.getMaxQualityFile().resolution })
    await createHlsJobIfEnabled(hlsPayload)

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

function createHlsJobIfEnabled (payload?: { videoUUID: string, resolution: number, isPortraitMode?: boolean }) {
  // Generate HLS playlist?
  if (payload && CONFIG.TRANSCODING.HLS.ENABLED) {
    const hlsTranscodingPayload = {
      type: 'hls' as 'hls',
      videoUUID: payload.videoUUID,
      resolution: payload.resolution,
      isPortraitMode: payload.isPortraitMode,
      copyCodecs: true
    }

    return JobQueue.Instance.createJob({ type: 'video-transcoding', payload: hlsTranscodingPayload })
  }
}

async function publishAndFederateIfNeeded (video: MVideoUUID) {
  const { videoDatabase, videoPublished } = await sequelizeTypescript.transaction(async t => {
    // Maybe the video changed in database, refresh it
    const videoDatabase = await VideoModel.loadAndPopulateAccountAndServerAndTags(video.uuid, t)
    // Video does not exist anymore
    if (!videoDatabase) return undefined

    // We transcoded the video file in another format, now we can publish it
    const videoPublished = await videoDatabase.publishIfNeededAndSave(t)

    // If the video was not published, we consider it is a new one for other instances
    await federateVideoIfNeeded(videoDatabase, videoPublished, t)

    return { videoDatabase, videoPublished }
  })

  if (videoPublished) {
    Notifier.Instance.notifyOnNewVideoIfNeeded(videoDatabase)
    Notifier.Instance.notifyOnVideoPublishedAfterTranscoding(videoDatabase)
  }
}
