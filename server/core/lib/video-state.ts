import { Transaction } from 'sequelize'
import { VideoState, VideoStateType } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideo, MVideoFullLight, MVideoUUID } from '@server/types/models/index.js'
import { federateVideoIfNeeded } from './activitypub/videos/index.js'
import { JobQueue } from './job-queue/index.js'
import { Notifier } from './notifier/index.js'
import { buildMoveVideoJob } from './video-jobs.js'

function buildNextVideoState (currentState?: VideoStateType) {
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

function moveToNextState (options: {
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
        return federateVideoIfNeeded(videoDatabase, false, t)
      }

      const newState = buildNextVideoState(videoDatabase.state)

      if (newState === VideoState.PUBLISHED) {
        return moveToPublishedState({ video: videoDatabase, previousVideoState, isNewVideo, transaction: t })
      }

      if (newState === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
        return moveToExternalStorageState({ video: videoDatabase, isNewVideo, transaction: t })
      }
    })
  })
}

// ---------------------------------------------------------------------------

async function moveToExternalStorageState (options: {
  video: MVideoFullLight
  isNewVideo: boolean
  transaction: Transaction
}) {
  const { video, isNewVideo, transaction } = options

  const videoJobInfo = await VideoJobInfoModel.load(video.id, transaction)
  const pendingTranscode = videoJobInfo?.pendingTranscode || 0

  // We want to wait all transcoding jobs before moving the video on an external storage
  if (pendingTranscode !== 0) return false

  const previousVideoState = video.state

  if (video.state !== VideoState.TO_MOVE_TO_EXTERNAL_STORAGE) {
    await video.setNewState(VideoState.TO_MOVE_TO_EXTERNAL_STORAGE, isNewVideo, transaction)
  }

  logger.info('Creating external storage move job for video %s.', video.uuid, { tags: [ video.uuid ] })

  try {
    await JobQueue.Instance.createJob(await buildMoveVideoJob({ video, previousVideoState, isNewVideo, type: 'move-to-object-storage' }))

    return true
  } catch (err) {
    logger.error('Cannot add move to object storage job', { err })

    return false
  }
}

async function moveToFileSystemState (options: {
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
    await JobQueue.Instance.createJob(await buildMoveVideoJob({ video, previousVideoState, isNewVideo, type: 'move-to-file-system' }))

    return true
  } catch (err) {
    logger.error('Cannot add move to file system job', { err })

    return false
  }
}

// ---------------------------------------------------------------------------

function moveToFailedTranscodingState (video: MVideo) {
  if (video.state === VideoState.TRANSCODING_FAILED) return

  return video.setNewState(VideoState.TRANSCODING_FAILED, false, undefined)
}

function moveToFailedMoveToObjectStorageState (video: MVideo) {
  if (video.state === VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED) return

  return video.setNewState(VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED, false, undefined)
}

function moveToFailedMoveToFileSystemState (video: MVideo) {
  if (video.state === VideoState.TO_MOVE_TO_FILE_SYSTEM_FAILED) return

  return video.setNewState(VideoState.TO_MOVE_TO_FILE_SYSTEM_FAILED, false, undefined)
}

// ---------------------------------------------------------------------------

export {
  buildNextVideoState,
  moveToFailedMoveToFileSystemState,
  moveToExternalStorageState,
  moveToFileSystemState,
  moveToFailedTranscodingState,
  moveToFailedMoveToObjectStorageState,
  moveToNextState
}

// ---------------------------------------------------------------------------

async function moveToPublishedState (options: {
  video: MVideoFullLight
  isNewVideo: boolean
  transaction: Transaction
  previousVideoState?: VideoStateType
}) {
  const { video, isNewVideo, transaction, previousVideoState } = options
  const previousState = previousVideoState ?? video.state

  logger.info('Publishing video %s.', video.uuid, { isNewVideo, previousState, tags: [ video.uuid ] })

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
