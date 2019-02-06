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
import { importVideoFile, optimizeVideofile, transcodeOriginalVideofile } from '../../video-transcoding'
import { Notifier } from '../../notifier'

export type VideoFilePayload = {
  videoUUID: string
  isNewVideo?: boolean
  resolution?: VideoResolution
  isPortraitMode?: boolean
}

export type VideoFileImportPayload = {
  videoUUID: string,
  filePath: string
}

async function processVideoFileImport (job: Bull.Job) {
  const payload = job.data as VideoFileImportPayload
  logger.info('Processing video file import in job %d.', job.id)

  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Do not process job %d, video does not exist.', job.id)
    return undefined
  }

  await importVideoFile(video, payload.filePath)

  await onVideoFileTranscoderOrImportSuccess(video)
  return video
}

async function processVideoFile (job: Bull.Job) {
  const payload = job.data as VideoFilePayload
  logger.info('Processing video file in job %d.', job.id)

  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Do not process job %d, video does not exist.', job.id)
    return undefined
  }

  // Transcoding in other resolution
  if (payload.resolution) {
    await transcodeOriginalVideofile(video, payload.resolution, payload.isPortraitMode || false)

    await retryTransactionWrapper(onVideoFileTranscoderOrImportSuccess, video)
  } else {
    await optimizeVideofile(video)

    await retryTransactionWrapper(onVideoFileOptimizerSuccess, video, payload.isNewVideo)
  }

  return video
}

async function onVideoFileTranscoderOrImportSuccess (video: VideoModel) {
  if (video === undefined) return undefined

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
    Notifier.Instance.notifyOnNewVideo(videoDatabase)
    Notifier.Instance.notifyOnPendingVideoPublished(videoDatabase)
  }
}

async function onVideoFileOptimizerSuccess (videoArg: VideoModel, isNewVideo: boolean) {
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
      const tasks: Bluebird<Bull.Job<any>>[] = []

      for (const resolution of resolutionsEnabled) {
        const dataInput = {
          videoUUID: videoDatabase.uuid,
          resolution
        }

        const p = JobQueue.Instance.createJob({ type: 'video-file', payload: dataInput })
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

    await federateVideoIfNeeded(videoDatabase, isNewVideo, t)

    return { videoDatabase, videoPublished }
  })

  if (isNewVideo) Notifier.Instance.notifyOnNewVideo(videoDatabase)
  if (videoPublished) Notifier.Instance.notifyOnPendingVideoPublished(videoDatabase)
}

// ---------------------------------------------------------------------------

export {
  processVideoFile,
  processVideoFileImport
}
