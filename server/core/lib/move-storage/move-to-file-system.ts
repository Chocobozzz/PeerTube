import { FileStorage, VideoStateType } from '@peertube/peertube-models'
import { scheduleVideoFederation } from '@server/lib/activitypub/videos/federate.js'
import { moveToFailedMoveToFileSystemState, moveToNextState } from '@server/lib/video-state.js'
import { VideoModel } from '@server/models/video/video.js'
import { moveCaptionToStorage } from './shared/move-caption.js'
import { moveVideoToStorage, onMoveVideoToStorageFailure } from './shared/move-video.js'

export async function moveVideoToFS (options: {
  videoUUID: string

  moveVideoState?: {
    previousVideoState: VideoStateType
  }
}) {
  const { videoUUID, moveVideoState } = options

  await moveVideoToStorage({ videoUUID, targetStorage: FileStorage.FILE_SYSTEM })

  if (options.moveVideoState) {
    const video = await VideoModel.load(videoUUID)

    await moveToNextState({ video, ...moveVideoState })
  } else {
    // Thumbnail and torrent URLs may have changed
    const video = await VideoModel.load(videoUUID)
    if (video) scheduleVideoFederation({ video })
  }
}

export function moveCaptionToFS (options: {
  captionId: number
}) {
  const { captionId } = options

  return moveCaptionToStorage({ captionId, targetStorage: FileStorage.FILE_SYSTEM })
}

export async function onMoveVideoToFSFailure (options: {
  videoUUID: string
  err: Error
  moveVideoState: { previousVideoState: VideoStateType } | undefined
}) {
  const { videoUUID, err, moveVideoState } = options

  await onMoveVideoToStorageFailure({ videoUUID, err, moveVideoState, moveToFailedState: moveToFailedMoveToFileSystemState })
}
