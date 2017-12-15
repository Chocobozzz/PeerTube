import * as Bluebird from 'bluebird'
import { computeResolutionsToTranscode, logger } from '../../../helpers'
import { sequelizeTypescript } from '../../../initializers'
import { VideoModel } from '../../../models/video/video'
import { shareVideoByServerAndChannel } from '../../activitypub'
import { sendCreateVideo } from '../../activitypub/send'
import { JobScheduler } from '../job-scheduler'
import { TranscodingJobPayload } from './transcoding-job-scheduler'

async function process (data: TranscodingJobPayload, jobId: number) {
  const video = await VideoModel.loadByUUIDAndPopulateAccountAndServerAndTags(data.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Do not process job %d, video does not exist.', jobId, { videoUUID: video.uuid })
    return undefined
  }

  await video.optimizeOriginalVideofile()

  return video
}

function onError (err: Error, jobId: number) {
  logger.error('Error when optimized video file in job %d.', jobId, err)
  return Promise.resolve()
}

async function onSuccess (jobId: number, video: VideoModel, jobScheduler: JobScheduler<TranscodingJobPayload, VideoModel>) {
  if (video === undefined) return undefined

  logger.info('Job %d is a success.', jobId)

  // Maybe the video changed in database, refresh it
  const videoDatabase = await VideoModel.loadByUUIDAndPopulateAccountAndServerAndTags(video.uuid)
  // Video does not exist anymore
  if (!videoDatabase) return undefined

  // Now we'll add the video's meta data to our followers
  await sendCreateVideo(video, undefined)
  // TODO: share by channel
  await shareVideoByServerAndChannel(video, undefined)

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
        const tasks: Bluebird<any>[] = []

        for (const resolution of resolutionsEnabled) {
          const dataInput = {
            videoUUID: videoDatabase.uuid,
            resolution
          }

          const p = jobScheduler.createJob(t, 'videoFileTranscoder', dataInput)
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
  process,
  onError,
  onSuccess
}
