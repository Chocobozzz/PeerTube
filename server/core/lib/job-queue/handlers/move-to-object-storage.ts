import { isMoveCaptionPayload, isMoveVideoStoragePayload, MoveStoragePayload } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import {
  moveCaptionToObjectStorage,
  moveVideoToObjectStorage,
  onMoveVideoToObjectStorageFailure
} from '@server/lib/move-storage/move-to-object-storage.js'
import { Job } from 'bullmq'

const logger = createLogger('object-storage', 'move-object-storage')

export async function processMoveToObjectStorage (job: Job) {
  const payload = job.data as MoveStoragePayload

  if (isMoveVideoStoragePayload(payload)) { // Move all video related files
    await logger.withContext([ payload.videoUUID ], async () => {
      logger.info(`Moving video ${payload.videoUUID} to object storage in job ${job.id}`)

      await moveVideoToObjectStorage({ videoUUID: payload.videoUUID, moveVideoState: payload.moveVideoState })
    })
  } else if (isMoveCaptionPayload(payload)) { // Only caption file
    logger.info(`Moving video caption ${payload.captionId} to object storage in job ${job.id}.`)

    return moveCaptionToObjectStorage({ captionId: payload.captionId })
  } else {
    throw new Error('Unknown payload type')
  }
}

export async function onMoveToObjectStorageFailure (job: Job, err: any) {
  const payload = job.data as MoveStoragePayload

  if (!isMoveVideoStoragePayload(payload)) return

  await logger.withContext([ payload.videoUUID ], () => onMoveVideoToObjectStorageFailure({ videoUUID: payload.videoUUID, err }))
}
