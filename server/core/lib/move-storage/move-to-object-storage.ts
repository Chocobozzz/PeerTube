import { FileStorage, VideoStateType } from '@peertube/peertube-models'
import { scheduleVideoFederation } from '@server/lib/activitypub/videos/federate.js'
import { moveToFailedMoveToObjectStorageState, moveToNextState } from '@server/lib/video-state.js'
import { VideoModel } from '@server/models/video/video.js'
import { moveCaptionToStorage } from './shared/move-caption.js'
import { moveVideoToStorage, onMoveVideoToStorageFailure } from './shared/move-video.js'

export async function moveVideoToObjectStorage (options: {
  videoUUID: string

  moveVideoState?: {
    previousVideoState: VideoStateType
  }
}) {
  const { videoUUID, moveVideoState } = options

  await moveVideoToStorage({ videoUUID, targetStorage: FileStorage.OBJECT_STORAGE })

  if (options.moveVideoState) {
    await moveToNextState({ video: { uuid: videoUUID }, ...moveVideoState })
  } else {
    const video = await VideoModel.load(videoUUID)
    if (video) scheduleVideoFederation({ video })
  }
}

export function moveCaptionToObjectStorage (options: {
  captionId: number
}) {
  const { captionId } = options

  return moveCaptionToStorage({ captionId, targetStorage: FileStorage.OBJECT_STORAGE })
}

export async function onMoveVideoToObjectStorageFailure (options: {
  videoUUID: string
  err: Error
  moveVideoState: { previousVideoState: VideoStateType } | undefined
}) {
  const { videoUUID, err, moveVideoState } = options

  await onMoveVideoToStorageFailure({ videoUUID, err, moveVideoState, moveToFailedState: moveToFailedMoveToObjectStorageState })
}
