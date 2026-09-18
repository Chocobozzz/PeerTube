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
import {
  moveCaptionToObjectStorage,
  moveVideoToObjectStorage,
  onMoveVideoToObjectStorageFailure
} from '@server/lib/move-storage/move-to-object-storage.js'
import { moveActorImagesToStorage } from '@server/lib/move-storage/shared/move-actor-image.js'
import { moveUploadImageToStorage } from '@server/lib/move-storage/shared/move-upload-image.js'
import { moveVideoPlaylistToStorage } from '@server/lib/move-storage/shared/move-video-playlist.js'
import { SharedFilesManager } from '@server/lib/shared-files/index.js'
import { Job } from 'bullmq'

const logger = createLogger('object-storage', 'move-object-storage')

export async function processMoveToObjectStorage (job: Job) {
  try {
    return await moveToObjectStorage(job)
  } finally {
    // Secondary processes may be able to manage these files now
    SharedFilesManager.Instance.notifyFilesMoved('moved-to-object-storage')
  }
}

async function moveToObjectStorage (job: Job) {
  const payload = job.data as MoveStoragePayload

  if (isMoveVideoStoragePayload(payload)) { // Move all video related files
    await logger.withContext([ payload.videoUUID ], async () => {
      logger.info(`Moving video ${payload.videoUUID} to object storage in job ${job.id}`)

      await moveVideoToObjectStorage({ videoUUID: payload.videoUUID, moveVideoState: payload.moveVideoState })
    })
  } else if (isMoveCaptionPayload(payload)) { // Only caption file
    logger.info(`Moving video caption ${payload.captionId} to object storage in job ${job.id}.`)

    return moveCaptionToObjectStorage({ captionId: payload.captionId })
  } else if (isMoveActorImagesPayload(payload)) { // Only the avatars/banners of an actor
    logger.info(`Moving images of actor ${payload.actorId} to object storage in job ${job.id}.`)

    return moveActorImagesToStorage({ actorId: payload.actorId, targetStorage: FileStorage.OBJECT_STORAGE })
  } else if (isMoveUploadImagePayload(payload)) { // Only an instance logo
    logger.info(`Moving upload image ${payload.uploadImageId} to object storage in job ${job.id}.`)

    return moveUploadImageToStorage({ uploadImageId: payload.uploadImageId, targetStorage: FileStorage.OBJECT_STORAGE })
  } else if (isMoveVideoPlaylistPayload(payload)) { // Only the playlist thumbnails
    logger.info(`Moving video playlist ${payload.videoPlaylistId} thumbnails to object storage in job ${job.id}.`)

    return moveVideoPlaylistToStorage({ videoPlaylistId: payload.videoPlaylistId, targetStorage: FileStorage.OBJECT_STORAGE })
  } else {
    throw new Error('Unknown payload type')
  }
}

export async function onMoveToObjectStorageFailure (job: Job, err: any) {
  const payload = job.data as MoveStoragePayload

  if (!isMoveVideoStoragePayload(payload)) return

  await logger.withContext(
    [ payload.videoUUID ],
    () => onMoveVideoToObjectStorageFailure({ videoUUID: payload.videoUUID, err, moveVideoState: payload.moveVideoState })
  )
}
