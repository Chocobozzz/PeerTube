import {
  FileStorage,
  isMoveActorImagesPayload,
  isMoveCaptionPayload,
  isMoveUploadImagePayload,
  isMoveVideoPlaylistPayload,
  isMoveVideoStoragePayload,
  MoveStoragePayload
} from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { moveCaptionToFS, moveVideoToFS, onMoveVideoToFSFailure } from '@server/lib/move-storage/move-to-file-system.js'
import { moveActorImagesToStorage } from '@server/lib/move-storage/shared/move-actor-image.js'
import { moveUploadImageToStorage } from '@server/lib/move-storage/shared/move-upload-image.js'
import { moveVideoPlaylistToStorage } from '@server/lib/move-storage/shared/move-video-playlist.js'
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
  } else if (isMoveActorImagesPayload(payload)) { // Only the avatars/banners of an actor
    logger.info(`Moving images of actor ${payload.actorId} to file system in job ${job.id}.`)

    return moveActorImagesToStorage({ actorId: payload.actorId, targetStorage: FileStorage.FILE_SYSTEM })
  } else if (isMoveUploadImagePayload(payload)) { // Only an instance logo
    logger.info(`Moving upload image ${payload.uploadImageId} to file system in job ${job.id}.`)

    return moveUploadImageToStorage({ uploadImageId: payload.uploadImageId, targetStorage: FileStorage.FILE_SYSTEM })
  } else if (isMoveVideoPlaylistPayload(payload)) { // Only the playlist thumbnails
    logger.info(`Moving video playlist ${payload.videoPlaylistId} thumbnails to file system in job ${job.id}.`)

    return moveVideoPlaylistToStorage({ videoPlaylistId: payload.videoPlaylistId, targetStorage: FileStorage.FILE_SYSTEM })
  } else {
    throw new Error('Unknown payload type')
  }
}

export async function onMoveToFileSystemFailure (job: Job, err: any) {
  const payload = job.data as MoveStoragePayload

  if (!isMoveVideoStoragePayload(payload)) return

  await logger.withContext(
    [ payload.videoUUID ],
    () => onMoveVideoToFSFailure({ videoUUID: payload.videoUUID, err, moveVideoState: payload.moveVideoState })
  )
}
