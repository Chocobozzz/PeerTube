import { LoggerTags, logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { VideoModel } from '@server/models/video/video.js'
import { MVideoWithAllFiles } from '@server/types/models/index.js'

export async function moveToJob (options: {
  jobId: string
  videoUUID: string
  loggerTags: string[]

  moveWebVideoFiles: (video: MVideoWithAllFiles) => Promise<void>
  moveHLSFiles: (video: MVideoWithAllFiles) => Promise<void>
  moveToFailedState: (video: MVideoWithAllFiles) => Promise<void>
  doAfterLastMove: (video: MVideoWithAllFiles) => Promise<void>
}) {
  const { jobId, loggerTags, videoUUID, moveHLSFiles, moveWebVideoFiles, moveToFailedState, doAfterLastMove } = options

  const lTagsBase = loggerTagsFactory(...loggerTags)

  const fileMutexReleaser = await VideoPathManager.Instance.lockFiles(videoUUID)

  const video = await VideoModel.loadWithFiles(videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Can\'t process job %d, video does not exist.', jobId, lTagsBase(videoUUID))
    fileMutexReleaser()
    return undefined
  }

  const lTags = lTagsBase(video.uuid, video.url)

  try {
    if (video.VideoFiles) {
      logger.debug('Moving %d web video files for video %s.', video.VideoFiles.length, video.uuid, lTags)

      await moveWebVideoFiles(video)
    }

    if (video.VideoStreamingPlaylists) {
      logger.debug('Moving HLS playlist of %s.', video.uuid)

      await moveHLSFiles(video)
    }

    const pendingMove = await VideoJobInfoModel.decrease(video.uuid, 'pendingMove')
    if (pendingMove === 0) {
      logger.info('Running cleanup after moving files (video %s in job %s)', video.uuid, jobId, lTags)

      await doAfterLastMove(video)
    }
  } catch (err) {
    await onMoveToStorageFailure({ videoUUID, err, lTags, moveToFailedState })

    throw err
  } finally {
    fileMutexReleaser()
  }
}

export async function onMoveToStorageFailure (options: {
  videoUUID: string
  err: any
  lTags: LoggerTags
  moveToFailedState: (video: MVideoWithAllFiles) => Promise<void>
}) {
  const { videoUUID, err, lTags, moveToFailedState } = options

  const video = await VideoModel.loadWithFiles(videoUUID)
  if (!video) return

  logger.error('Cannot move video %s storage.', video.url, { err, ...lTags })

  await moveToFailedState(video)
  await VideoJobInfoModel.abortAllTasks(video.uuid, 'pendingMove')
}
