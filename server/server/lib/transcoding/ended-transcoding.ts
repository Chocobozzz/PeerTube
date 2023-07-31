import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { MVideo } from '@server/types/models/index.js'
import { moveToNextState } from '../video-state.js'

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
