import { VideoState, VideoStateType } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo, MVideoFullLight, MVideoUUID } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { federateVideoIfNeeded } from './activitypub/videos/index.js'
import { JobQueue } from './job-queue/index.js'
import { Notifier } from './notifier/index.js'
import { buildMoveVideoJob } from './video-jobs.js'

const lTags = loggerTagsFactory('video-state')

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
    CONFIG.OBJECT_STORAGE.ENABLED
  ) {
    return VideoState.TO_MOVE_TO_EXTERNAL_STORAGE
  }

  return VideoState.PUBLISHED
}

export function moveToNextState (options: {
  video: MVideoUUID
  previousVideoState?: VideoStateType
  isNewVideo?: boolean // Default true
}) {
  const { video, previousVideoState, isNewVideo = true } = options

  return retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async t => {
      // Maybe the video changed in database, refresh it
      const videoDatabase = await VideoModel.loadFull(video.uuid, t)
      // Video does not exist anymore
      if (!videoDatabase) return undefined

      // Already in its final state
      if (videoDatabase.state === VideoState.PUBLISHED) {
        await federateVideoIfNeeded(videoDatabase, false, t)

        logger.debug(`Video ${videoDatabase.uuid} is already published, no state change.`, lTags(videoDatabase.uuid))

        return false
      }

      const newState = buildNextVideoState(videoDatabase.state)

      if (newState === VideoState.PUBLISHED) {
        await moveToPublishedState({ video: videoDatabase, previousVideoState, isNewVideo, transaction: t })
        return true
      }

      if (newState === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
        await moveToExternalStorageState({ video: videoDatabase, isNewVideo, transaction: t })
        return true
      }

      throw new Error('Unknown next state for video ' + videoDatabase.uuid + ': ' + newState)
    })
  })
}

// ---------------------------------------------------------------------------

export async function moveToExternalStorageState (options: {
  video: MVideoFullLight
  isNewVideo: boolean
  transaction: Transaction
}) {
  const { video, isNewVideo, transaction } = options

  const previousVideoState = video.state

  if (video.state !== VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
    await video.setNewState(VideoState.TO_MOVE_TO_EXTERNAL_STORAGE, isNewVideo, transaction)
  }

  logger.info('Creating external storage move job for video %s.', video.uuid, lTags(video.uuid))

  try {
    await JobQueue.Instance.createJob(
      await buildMoveVideoJob({
        type: 'move-to-object-storage',
        video,
        moveVideoState: { isNewVideo, previousVideoState }
      })
    )

    return true
  } catch (err) {
    logger.error('Cannot add move to object storage job', { err, ...lTags(video.uuid) })

    return false
  }
}

export async function moveToFileSystemState (options: {
  video: MVideoFullLight
  isNewVideo: boolean
  transaction: Transaction
}) {
  const { video, isNewVideo, transaction } = options

  const previousVideoState = video.state

  if (video.state !== VideoState.TO_MOVE_TO_FILE_SYSTEM) {
    await video.setNewState(VideoState.TO_MOVE_TO_FILE_SYSTEM, false, transaction)
  }

  logger.info('Creating move to file system job for video %s.', video.uuid, { tags: [ video.uuid ] })

  try {
    await JobQueue.Instance.createJob(
      await buildMoveVideoJob({
        type: 'move-to-file-system',
        video,
        moveVideoState: {
          previousVideoState,
          isNewVideo
        }
      })
    )

    return true
  } catch (err) {
    logger.error('Cannot add move to file system job', { err, ...lTags(video.uuid) })

    return false
  }
}

// ---------------------------------------------------------------------------

export function moveToFailedTranscodingState (video: MVideo) {
  if (video.state === VideoState.TRANSCODING_FAILED) return

  return video.setNewState(VideoState.TRANSCODING_FAILED, false, undefined)
}

export function moveToFailedMoveToObjectStorageState (video: MVideo) {
  if (video.state === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED) return

  return video.setNewState(VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED, false, undefined)
}

export function moveToFailedMoveToFileSystemState (video: MVideo) {
  if (video.state === VideoState.TO_MOVE_TO_FILE_SYSTEM_FAILED) return

  return video.setNewState(VideoState.TO_MOVE_TO_FILE_SYSTEM_FAILED, false, undefined)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function moveToPublishedState (options: {
  video: MVideoFullLight
  isNewVideo: boolean
  transaction: Transaction
  previousVideoState?: VideoStateType
}) {
  const { video, isNewVideo, transaction, previousVideoState } = options
  const previousState = previousVideoState ?? video.state

  logger.info('Publishing video %s.', video.uuid, { isNewVideo, previousState, ...lTags(video.uuid) })

  await video.setNewState(VideoState.PUBLISHED, isNewVideo, transaction)

  await federateVideoIfNeeded(video, isNewVideo, transaction)

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
