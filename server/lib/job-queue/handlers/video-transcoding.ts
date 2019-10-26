import * as Bull from 'bull'
import { VideoResolution, VideoState } from '../../../../shared'
import { logger } from '../../../helpers/logger'
import { VideoModel } from '../../../models/video/video'
import { JobQueue } from '../job-queue'
import { federateVideoIfNeeded } from '../../activitypub'
import { retryTransactionWrapper } from '../../../helpers/database-utils'
import { sequelizeTypescript } from '../../../initializers'
import * as Bluebird from 'bluebird'
import { computeResolutionsToTranscode } from '../../../helpers/ffmpeg-utils'
import { generateHlsPlaylist, optimizeVideofile, transcodeOriginalVideofile, mergeAudioVideofile } from '../../video-transcoding'
import { Notifier } from '../../notifier'
import { CONFIG } from '../../../initializers/config'
import { MVideoUUID, MVideoWithFile } from '@server/typings/models'

interface BaseTranscodingPayload {
  videoUUID: string
  isNewVideo?: boolean
}

interface HLSTranscodingPayload extends BaseTranscodingPayload {
  type: 'hls'
  isPortraitMode?: boolean
  resolution: VideoResolution
}

interface NewResolutionTranscodingPayload extends BaseTranscodingPayload {
  type: 'new-resolution'
  isPortraitMode?: boolean
  resolution: VideoResolution
}

interface MergeAudioTranscodingPayload extends BaseTranscodingPayload {
  type: 'merge-audio'
  resolution: VideoResolution
}

interface OptimizeTranscodingPayload extends BaseTranscodingPayload {
  type: 'optimize'
}

export type VideoTranscodingPayload = HLSTranscodingPayload | NewResolutionTranscodingPayload
  | OptimizeTranscodingPayload | MergeAudioTranscodingPayload

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
    await generateHlsPlaylist(video, payload.resolution, payload.isPortraitMode || false)

    await retryTransactionWrapper(onHlsPlaylistGenerationSuccess, video)
  } else if (payload.type === 'new-resolution') {
    await transcodeOriginalVideofile(video, payload.resolution, payload.isPortraitMode || false)

    await retryTransactionWrapper(publishNewResolutionIfNeeded, video, payload)
  } else if (payload.type === 'merge-audio') {
    await mergeAudioVideofile(video, payload.resolution)

    await retryTransactionWrapper(publishNewResolutionIfNeeded, video, payload)
  } else {
    await optimizeVideofile(video)

    await retryTransactionWrapper(onVideoFileOptimizerSuccess, video, payload)
  }

  return video
}

async function onHlsPlaylistGenerationSuccess (video: MVideoUUID) {
  if (video === undefined) return undefined

  await sequelizeTypescript.transaction(async t => {
    // Maybe the video changed in database, refresh it
    let videoDatabase = await VideoModel.loadAndPopulateAccountAndServerAndTags(video.uuid, t)
    // Video does not exist anymore
    if (!videoDatabase) return undefined

    // If the video was not published, we consider it is a new one for other instances
    await federateVideoIfNeeded(videoDatabase, false, t)
  })
}

async function publishNewResolutionIfNeeded (video: MVideoUUID, payload?: NewResolutionTranscodingPayload | MergeAudioTranscodingPayload) {
  const { videoDatabase, videoPublished } = await sequelizeTypescript.transaction(async t => {
    // Maybe the video changed in database, refresh it
    let videoDatabase = await VideoModel.loadAndPopulateAccountAndServerAndTags(video.uuid, t)
    // Video does not exist anymore
    if (!videoDatabase) return undefined

    let videoPublished = false

    // We transcoded the video file in another format, now we can publish it
    if (videoDatabase.state !== VideoState.PUBLISHED) {
      videoPublished = true

      videoDatabase.state = VideoState.PUBLISHED
      videoDatabase.publishedAt = new Date()
      videoDatabase = await videoDatabase.save({ transaction: t })
    }

    // If the video was not published, we consider it is a new one for other instances
    await federateVideoIfNeeded(videoDatabase, videoPublished, t)

    return { videoDatabase, videoPublished }
  })

  if (videoPublished) {
    Notifier.Instance.notifyOnNewVideoIfNeeded(videoDatabase)
    Notifier.Instance.notifyOnVideoPublishedAfterTranscoding(videoDatabase)
  }

  await createHlsJobIfEnabled(payload)
}

async function onVideoFileOptimizerSuccess (videoArg: MVideoWithFile, payload: OptimizeTranscodingPayload) {
  if (videoArg === undefined) return undefined

  // Outside the transaction (IO on disk)
  const { videoFileResolution } = await videoArg.getOriginalFileResolution()

  const { videoDatabase, videoPublished } = await sequelizeTypescript.transaction(async t => {
    // Maybe the video changed in database, refresh it
    let videoDatabase = await VideoModel.loadAndPopulateAccountAndServerAndTags(videoArg.uuid, t)
    // Video does not exist anymore
    if (!videoDatabase) return undefined

    // Create transcoding jobs if there are enabled resolutions
    const resolutionsEnabled = computeResolutionsToTranscode(videoFileResolution)
    logger.info(
      'Resolutions computed for video %s and origin file height of %d.', videoDatabase.uuid, videoFileResolution,
      { resolutions: resolutionsEnabled }
    )

    let videoPublished = false

    if (resolutionsEnabled.length !== 0) {
      const tasks: (Bluebird<Bull.Job<any>> | Promise<Bull.Job<any>>)[] = []

      for (const resolution of resolutionsEnabled) {
        const dataInput = {
          type: 'new-resolution' as 'new-resolution',
          videoUUID: videoDatabase.uuid,
          resolution
        }

        const p = JobQueue.Instance.createJob({ type: 'video-transcoding', payload: dataInput })
        tasks.push(p)
      }

      await Promise.all(tasks)

      logger.info('Transcoding jobs created for uuid %s.', videoDatabase.uuid, { resolutionsEnabled })
    } else {
      videoPublished = true

      // No transcoding to do, it's now published
      videoDatabase.state = VideoState.PUBLISHED
      videoDatabase = await videoDatabase.save({ transaction: t })

      logger.info('No transcoding jobs created for video %s (no resolutions).', videoDatabase.uuid, { privacy: videoDatabase.privacy })
    }

    await federateVideoIfNeeded(videoDatabase, payload.isNewVideo, t)

    return { videoDatabase, videoPublished }
  })

  if (payload.isNewVideo) Notifier.Instance.notifyOnNewVideoIfNeeded(videoDatabase)
  if (videoPublished) Notifier.Instance.notifyOnVideoPublishedAfterTranscoding(videoDatabase)

  const hlsPayload = Object.assign({}, payload, { resolution: videoDatabase.getOriginalFile().resolution })
  await createHlsJobIfEnabled(hlsPayload)
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
      isPortraitMode: payload.isPortraitMode
    }

    return JobQueue.Instance.createJob({ type: 'video-transcoding', payload: hlsTranscodingPayload })
  }
}
