import { FileStorage } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { CONFIG } from '@server/initializers/config.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { MVideo } from '@server/types/models/index.js'
import { JobQueue } from '../job-queue/job-queue.js'
import { hasVideoResourcesToBeMoved } from '../move-storage/shared/move-video.js'
import { buildMoveVideoJob } from '../video-jobs.js'
import { moveToNextState } from '../video-state.js'

export async function onTranscodingEnded (options: {
  video: MVideo
  isNewVideo: boolean
  moveVideoToNextState: boolean
}) {
  const { video, isNewVideo, moveVideoToNextState } = options

  await VideoJobInfoModel.decrease(video.uuid, 'pendingTranscode')

  if (moveVideoToNextState) {
    const changedState = await retryTransactionWrapper(moveToNextState, { video, isNewVideo })

    // Still send the transcoded file to external storage if needed
    if (!changedState && CONFIG.OBJECT_STORAGE.ENABLED && await hasVideoResourcesToBeMoved(video, FileStorage.OBJECT_STORAGE)) {
      await JobQueue.Instance.createJob(await buildMoveVideoJob({ type: 'move-to-object-storage', video }))
    }
  }
}
