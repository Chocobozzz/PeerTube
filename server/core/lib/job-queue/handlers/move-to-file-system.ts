import { isMoveCaptionPayload, isMoveVideoStoragePayload, MoveStoragePayload } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { moveCaptionToFS, moveVideoToFS, onMoveVideoToFSFailure } from '@server/lib/move-storage/move-to-file-system.js'
import { Job } from 'bullmq'

const lTagsBase = loggerTagsFactory('move-file-system')

export async function processMoveToFileSystem (job: Job) {
  const payload = job.data as MoveStoragePayload

  if (isMoveVideoStoragePayload(payload)) { // Move all video related files
    logger.info(`Moving video ${payload.videoUUID} to file system in job ${job.id}.`, lTagsBase(payload.videoUUID))

    const moveVideoState = payload.isNewVideo !== undefined
      ? { isNewVideo: payload.isNewVideo, previousVideoState: payload.previousVideoState }
      : payload.moveVideoState

    return moveVideoToFS({
      videoUUID: payload.videoUUID,
      moveVideoState,
      loggerTags: lTagsBase().tags
    })
  } else if (isMoveCaptionPayload(payload)) { // Only caption file
    logger.info(`Moving video caption ${payload.captionId} to file system in job ${job.id}.`, lTagsBase(payload.captionId))

    return moveCaptionToFS({
      captionId: payload.captionId,
      loggerTags: lTagsBase().tags
    })
  } else {
    throw new Error('Unknown payload type')
  }
}

export async function onMoveToFileSystemFailure (job: Job, err: any) {
  const payload = job.data as MoveStoragePayload

  if (!isMoveVideoStoragePayload(payload)) return

  await onMoveVideoToFSFailure({
    videoUUID: payload.videoUUID,
    err,
    loggerTags: lTagsBase().tags
  })
}
