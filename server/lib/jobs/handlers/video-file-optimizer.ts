import * as Promise from 'bluebird'

import { database as db } from '../../../initializers/database'
import { logger, computeResolutionsToTranscode } from '../../../helpers'
import { VideoInstance } from '../../../models'
import { addVideoToFriends } from '../../friends'
import { JobScheduler } from '../job-scheduler'

function process (data: { videoUUID: string }, jobId: number) {
  return db.Video.loadByUUIDAndPopulateAuthorAndPodAndTags(data.videoUUID).then(video => {
    // No video, maybe deleted?
    if (!video) {
      logger.info('Do not process job %d, video does not exist.', jobId, { videoUUID: video.uuid })
      return undefined
    }

    return video.optimizeOriginalVideofile().then(() => video)
  })
}

function onError (err: Error, jobId: number) {
  logger.error('Error when optimized video file in job %d.', jobId, err)
  return Promise.resolve()
}

function onSuccess (jobId: number, video: VideoInstance) {
  if (video === undefined) return undefined

  logger.info('Job %d is a success.', jobId)

  video.toAddRemoteJSON()
    .then(remoteVideo => {
      // Now we'll add the video's meta data to our friends
      return addVideoToFriends(remoteVideo, null)
    })
    .then(() => {
      return video.getOriginalFileHeight()
    })
    .then(originalFileHeight => {
      // Create transcoding jobs if there are enabled resolutions
      const resolutionsEnabled = computeResolutionsToTranscode(originalFileHeight)
      logger.info(
        'Resolutions computed for video %s and origin file height of %d.', video.uuid, originalFileHeight,
        { resolutions: resolutionsEnabled }
      )

      if (resolutionsEnabled.length === 0) return undefined

      return db.sequelize.transaction(t => {
        const tasks: Promise<any>[] = []

        resolutionsEnabled.forEach(resolution => {
          const dataInput = {
            videoUUID: video.uuid,
            resolution
          }

          const p = JobScheduler.Instance.createJob(t, 'videoFileTranscoder', dataInput)
          tasks.push(p)
        })

        return Promise.all(tasks).then(() => resolutionsEnabled)
      })
    })
    .then(resolutionsEnabled => {
      if (resolutionsEnabled === undefined) {
        logger.info('No transcoding jobs created for video %s (no resolutions enabled).')
        return undefined
      }

      logger.info('Transcoding jobs created for uuid %s.', video.uuid, { resolutionsEnabled })
    })
    .catch((err: Error) => {
      logger.debug('Cannot transcode the video.', err)
      throw err
    })

}

// ---------------------------------------------------------------------------

export {
  process,
  onError,
  onSuccess
}
