import { isMoveCaptionPayload, isMoveVideoStoragePayload, MoveStoragePayload } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { moveCaptionToFS, moveVideoToFS, onMoveVideoToFSFailure } from '@server/lib/move-storage/move-to-file-system.js'
import { Job } from 'bullmq'

const logger = createLogger('move-file-system')

export async function processMoveToFileSystem (job: Job) {
  const payload = job.data as MoveStoragePayload

  if (isMoveVideoStoragePayload(payload)) { // Move all video related files
    return logger.withContext([ payload.videoUUID ], async () => {
      logger.info(`Moving video ${payload.videoUUID} to file system in job ${job.id}.`)

      return moveVideoToFS({ videoUUID: payload.videoUUID, moveVideoState: payload.moveVideoState })
    })
  } else if (isMoveCaptionPayload(payload)) { // Only caption file
    logger.info(`Moving video caption ${payload.captionId} to file system in job ${job.id}.`)

    return moveCaptionToFS({ captionId: payload.captionId })
  } else {
    throw new Error('Unknown payload type')
  }
}

export async function onMoveToFileSystemFailure (job: Job, err: any) {
  const payload = job.data as MoveStoragePayload

  if (!isMoveVideoStoragePayload(payload)) return

  await logger.withContext([ payload.videoUUID ], () => onMoveVideoToFSFailure({ videoUUID: payload.videoUUID, err }))
}
