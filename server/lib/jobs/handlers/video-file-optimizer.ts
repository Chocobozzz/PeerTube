import * as Bluebird from 'bluebird'

import { database as db } from '../../../initializers/database'
import { logger, computeResolutionsToTranscode } from '../../../helpers'
import { VideoInstance } from '../../../models'
import { addVideoToFriends } from '../../friends'
import { JobScheduler } from '../job-scheduler'

async function process (data: { videoUUID: string }, jobId: number) {
  const video = await db.Video.loadByUUIDAndPopulateAuthorAndPodAndTags(data.videoUUID)
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

async function onSuccess (jobId: number, video: VideoInstance) {
  if (video === undefined) return undefined

  logger.info('Job %d is a success.', jobId)

  const remoteVideo = await video.toAddRemoteJSON()

  // Now we'll add the video's meta data to our friends
  await addVideoToFriends(remoteVideo, null)

  const originalFileHeight = await video.getOriginalFileHeight()
  // Create transcoding jobs if there are enabled resolutions

  const resolutionsEnabled = computeResolutionsToTranscode(originalFileHeight)
  logger.info(
    'Resolutions computed for video %s and origin file height of %d.', video.uuid, originalFileHeight,
    { resolutions: resolutionsEnabled }
  )

  if (resolutionsEnabled.length !== 0) {
    try {
      await db.sequelize.transaction(async t => {
        const tasks: Bluebird<any>[] = []

        for (const resolution of resolutionsEnabled) {
          const dataInput = {
            videoUUID: video.uuid,
            resolution
          }

          const p = JobScheduler.Instance.createJob(t, 'videoFileTranscoder', dataInput)
          tasks.push(p)
        }

        await Promise.all(tasks)
      })

      logger.info('Transcoding jobs created for uuid %s.', video.uuid, { resolutionsEnabled })
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
