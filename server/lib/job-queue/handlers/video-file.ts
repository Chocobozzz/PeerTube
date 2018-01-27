import * as kue from 'kue'
import { VideoResolution } from '../../../../shared'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { logger } from '../../../helpers/logger'
import { computeResolutionsToTranscode } from '../../../helpers/utils'
import { sequelizeTypescript } from '../../../initializers'
import { VideoModel } from '../../../models/video/video'
import { shareVideoByServerAndChannel } from '../../activitypub'
import { sendCreateVideo, sendUpdateVideo } from '../../activitypub/send'
import { JobQueue } from '../job-queue'

export type VideoFilePayload = {
  videoUUID: string
  resolution?: VideoResolution
}

async function processVideoFile (job: kue.Job) {
  const payload = job.data as VideoFilePayload
  logger.info('Processing video file in job %d.', job.id)

  const video = await VideoModel.loadByUUIDAndPopulateAccountAndServerAndTags(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Do not process job %d, video does not exist.', job.id, { videoUUID: video.uuid })
    return undefined
  }

  // Transcoding in other resolution
  if (payload.resolution) {
    await video.transcodeOriginalVideofile(payload.resolution)
    await onVideoFileTranscoderSuccess(video)
  } else {
    await video.optimizeOriginalVideofile()
    await onVideoFileOptimizerSuccess(video)
  }

  return video
}

async function onVideoFileTranscoderSuccess (video: VideoModel) {
  if (video === undefined) return undefined

  // Maybe the video changed in database, refresh it
  const videoDatabase = await VideoModel.loadByUUIDAndPopulateAccountAndServerAndTags(video.uuid)
  // Video does not exist anymore
  if (!videoDatabase) return undefined

  if (video.privacy !== VideoPrivacy.PRIVATE) {
    await sendUpdateVideo(video, undefined)
  }

  return undefined
}

async function onVideoFileOptimizerSuccess (video: VideoModel) {
  if (video === undefined) return undefined

  // Maybe the video changed in database, refresh it
  const videoDatabase = await VideoModel.loadByUUIDAndPopulateAccountAndServerAndTags(video.uuid)
  // Video does not exist anymore
  if (!videoDatabase) return undefined

  if (video.privacy !== VideoPrivacy.PRIVATE) {
    // Now we'll add the video's meta data to our followers
    await sendCreateVideo(video, undefined)
    await shareVideoByServerAndChannel(video, undefined)
  }

  const originalFileHeight = await videoDatabase.getOriginalFileHeight()

  // Create transcoding jobs if there are enabled resolutions
  const resolutionsEnabled = computeResolutionsToTranscode(originalFileHeight)
  logger.info(
    'Resolutions computed for video %s and origin file height of %d.', videoDatabase.uuid, originalFileHeight,
    { resolutions: resolutionsEnabled }
  )

  if (resolutionsEnabled.length !== 0) {
    try {
      await sequelizeTypescript.transaction(async t => {
        const tasks: Promise<any>[] = []

        for (const resolution of resolutionsEnabled) {
          const dataInput = {
            videoUUID: videoDatabase.uuid,
            resolution
          }

          const p = JobQueue.Instance.createJob({ type: 'video-file', payload: dataInput })
          tasks.push(p)
        }

        await Promise.all(tasks)
      })

      logger.info('Transcoding jobs created for uuid %s.', videoDatabase.uuid, { resolutionsEnabled })
    } catch (err) {
      logger.warn('Cannot transcode the video.', err)
    }
  } else {
    logger.info('No transcoding jobs created for video %s (no resolutions enabled).')
    return undefined
  }
}

// ---------------------------------------------------------------------------

export {
  processVideoFile
}
