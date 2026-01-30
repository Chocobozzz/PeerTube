import { isMoveCaptionPayload, isMoveVideoStoragePayload, MoveStoragePayload } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import {
  moveCaptionToObjectStorage,
  moveVideoToObjectStorage,
  onMoveVideoToObjectStorageFailure
} from '@server/lib/move-storage/move-to-object-storage.js'
import { Job } from 'bullmq'

const lTagsBase = loggerTagsFactory('move-object-storage')

export async function processMoveToObjectStorage (job: Job) {
  const payload = job.data as MoveStoragePayload

  if (isMoveVideoStoragePayload(payload)) { // Move all video related files
    logger.info(`Moving video ${payload.videoUUID} to object storage in job ${job.id}`, lTagsBase(payload.videoUUID))

    const moveVideoState = payload.isNewVideo !== undefined
      ? { isNewVideo: payload.isNewVideo, previousVideoState: payload.previousVideoState }
      : payload.moveVideoState

    await moveVideoToObjectStorage({
      videoUUID: payload.videoUUID,
      moveVideoState,
      loggerTags: lTagsBase().tags
    })
  } else if (isMoveCaptionPayload(payload)) { // Only caption file
    logger.info(`Moving video caption ${payload.captionId} to object storage in job ${job.id}.`, lTagsBase(payload.captionId))

    return moveCaptionToObjectStorage({
      captionId: payload.captionId,
      loggerTags: lTagsBase().tags
    })
  } else {
    throw new Error('Unknown payload type')
  }
}

export async function onMoveToObjectStorageFailure (job: Job, err: any) {
  const payload = job.data as MoveStoragePayload

  if (!isMoveVideoStoragePayload(payload)) return

  await onMoveVideoToObjectStorageFailure({
    videoUUID: payload.videoUUID,
    err,
    loggerTags: lTagsBase().tags
  })
}
