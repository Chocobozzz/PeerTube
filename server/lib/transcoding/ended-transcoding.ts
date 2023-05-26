import { retryTransactionWrapper } from '@server/helpers/database-utils'
import { VideoJobInfoModel } from '@server/models/video/video-job-info'
import { MVideo } from '@server/types/models'
import { moveToNextState } from '../video-state'

export async function onTranscodingEnded (options: {
  video: MVideo
  isNewVideo: boolean
  moveVideoToNextState: boolean
}) {
  const { video, isNewVideo, moveVideoToNextState } = options

  await VideoJobInfoModel.decrease(video.uuid, 'pendingTranscode')

  if (moveVideoToNextState) {
    await retryTransactionWrapper(moveToNextState, { video, isNewVideo })
  }
}
