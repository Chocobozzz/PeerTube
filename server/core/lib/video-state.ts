import { FileStorage, FileStorageType, VideoState, VideoStateType } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { isVideoFilesObjectStorageEnabled } from '@server/lib/object-storage/config.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo, MVideoFull, MVideoUUID } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { scheduleVideoFederation } from './activitypub/videos/index.js'
import { JobQueue } from './job-queue/index.js'
import { Notifier } from './notifier/index.js'
import { buildMoveVideoJob } from './video-jobs.js'

const logger = createLogger('video-state')

export function buildNextVideoState (currentState?: VideoStateType) {
  if (currentState === VideoState.PUBLISHED) {
    throw new Error('Video is already in its final state')
  }

  if (
    currentState !== VideoState.TO_EDIT &&
    currentState !== VideoState.TO_TRANSCODE &&
    currentState !== VideoState.TO_MOVE_TO_EXTERNAL_STORAGE &&
    currentState !== VideoState.TO_MOVE_TO_FILE_SYSTEM &&
    CONFIG.TRANSCODING.ENABLED
  ) {
    return VideoState.TO_TRANSCODE
  }

  if (
    currentState !== VideoState.TO_MOVE_TO_EXTERNAL_STORAGE &&
    currentState !== VideoState.TO_MOVE_TO_FILE_SYSTEM &&
    isVideoFilesObjectStorageEnabled()
  ) {
    return VideoState.TO_MOVE_TO_EXTERNAL_STORAGE
  }

  return VideoState.PUBLISHED
}

export function moveToNextState (options: {
  video: MVideoUUID
  previousVideoState?: VideoStateType
}) {
  const { video, previousVideoState } = options

  return retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async t => {
      // Maybe the video changed in database, refresh it
      const videoDatabase = await VideoModel.loadFull(video.uuid, t)
      // Video does not exist anymore
      if (!videoDatabase) return undefined

      // Already in its final state
      if (videoDatabase.state === VideoState.PUBLISHED) {
        scheduleVideoFederation({ video: videoDatabase, transaction: t })

        logger.debug(`Video ${videoDatabase.uuid} is already published, no state change.`)

        return false
      }

      const newState = buildNextVideoState(videoDatabase.state)

      if (newState === VideoState.PUBLISHED) {
        await moveToPublishedState({ video: videoDatabase, previousVideoState, transaction: t })
        return true
      }

      if (newState === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
        await moveToStorageAndUpdateState({ video: videoDatabase, targetStorage: FileStorage.OBJECT_STORAGE, transaction: t })
        return true
      }

      // Keep video in failed state
      const failedStates = new Set<VideoStateType>([
        VideoState.TRANSCODING_FAILED,
        VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED,
        VideoState.TO_MOVE_TO_FILE_SYSTEM_FAILED
      ])
      if (failedStates.has(videoDatabase.state)) {
        return true
      }

      throw new Error('Unknown next state for video ' + videoDatabase.uuid + ': ' + newState)
    })
  })
}

// ---------------------------------------------------------------------------

export async function moveToStorageAndUpdateState (options: {
  video: MVideoFull
  targetStorage: FileStorageType
  transaction: Transaction
}) {
  const { video, targetStorage, transaction } = options

  const targetState = targetStorage === FileStorage.OBJECT_STORAGE
    ? VideoState.TO_MOVE_TO_EXTERNAL_STORAGE
    : VideoState.TO_MOVE_TO_FILE_SYSTEM

  const previousVideoState = video.state

  if (video.state !== targetState) {
    await video.setNewStateAndPublishedAt({ newState: targetState, transaction })
  }

  if (targetState === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
    logger.info('Creating external storage move job for video %s.', video.uuid)
  } else {
    logger.info('Creating move to file system job for video %s.', video.uuid)
  }

  try {
    await JobQueue.Instance.createJob(
      await buildMoveVideoJob({
        type: targetStorage === FileStorage.OBJECT_STORAGE
          ? 'move-to-object-storage'
          : 'move-to-file-system',
        video,
        moveVideoState: { previousVideoState }
      })
    )

    return true
  } catch (err) {
    if (targetState === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
      logger.error('Cannot add move to object storage job', { err })
    } else {
      logger.error('Cannot add move to file system job', { err })
    }

    return false
  }
}

// ---------------------------------------------------------------------------

export function moveToFailedTranscodingState (video: MVideo) {
  if (video.state === VideoState.TRANSCODING_FAILED) return

  return video.setNewStateAndPublishedAt({ newState: VideoState.TRANSCODING_FAILED, transaction: undefined })
}

export function moveToFailedMoveToObjectStorageState (video: MVideo) {
  if (video.state === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED) return

  return video.setNewStateAndPublishedAt({ newState: VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED, transaction: undefined })
}

export function moveToFailedMoveToFileSystemState (video: MVideo) {
  if (video.state === VideoState.TO_MOVE_TO_FILE_SYSTEM_FAILED) return

  return video.setNewStateAndPublishedAt({ newState: VideoState.TO_MOVE_TO_FILE_SYSTEM_FAILED, transaction: undefined })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function moveToPublishedState (options: {
  video: MVideoFull
  transaction: Transaction
  previousVideoState?: VideoStateType
}) {
  const { video, transaction, previousVideoState } = options
  const previousState = previousVideoState ?? video.state

  logger.info('Publishing video %s.', video.uuid, { previousState })

  const isNewVideo = !video.firstPublishedAt

  await video.setNewStateAndPublishedAt({ newState: VideoState.PUBLISHED, transaction })

  scheduleVideoFederation({ video, transaction })

  if (previousState === VideoState.TO_EDIT) {
    Notifier.Instance.notifyOfFinishedVideoStudioEdition(video)
    return
  }

  if (isNewVideo) {
    Notifier.Instance.notifyOnNewVideoOrLiveIfNeeded(video)

    if (previousState === VideoState.TO_TRANSCODE) {
      Notifier.Instance.notifyOnVideoPublishedAfterTranscoding(video)
    }
  }
}
