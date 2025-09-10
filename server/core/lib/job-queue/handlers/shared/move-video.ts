import { LoggerTags, logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { VideoSourceModel } from '@server/models/video/video-source.js'
import { VideoModel } from '@server/models/video/video.js'
import { MStreamingPlaylistVideoUUID, MVideoCaption, MVideoWithAllFiles } from '@server/types/models/index.js'
import { MVideoSource } from '@server/types/models/video/video-source.js'

export async function moveVideoToStorageJob (options: {
  jobId: string
  videoUUID: string
  loggerTags: (number | string)[]

  moveWebVideoFiles: (video: MVideoWithAllFiles) => Promise<void>
  moveHLSFiles: (video: MVideoWithAllFiles) => Promise<void>
  moveVideoSourceFile: (source: MVideoSource) => Promise<void>
  moveCaptionFiles: (captions: MVideoCaption[], hls: MStreamingPlaylistVideoUUID) => Promise<void>

  doAfterLastMove: (video: MVideoWithAllFiles) => Promise<void>
}) {
  const {
    jobId,
    loggerTags,
    videoUUID,
    moveVideoSourceFile,
    moveHLSFiles,
    moveWebVideoFiles,
    moveCaptionFiles,
    doAfterLastMove
  } = options

  const lTagsBase = loggerTagsFactory(...loggerTags)

  const fileMutexReleaser = await VideoPathManager.Instance.lockFiles(videoUUID)

  const video = await VideoModel.loadWithFiles(videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info(`Can't process job ${jobId}, video does not exist.`, lTagsBase(videoUUID))
    fileMutexReleaser()
    return undefined
  }

  const lTags = lTagsBase(video.uuid, video.url)

  try {
    const source = await VideoSourceModel.loadLatest(video.id)
    if (source?.keptOriginalFilename) {
      logger.debug(`Moving video source ${source.keptOriginalFilename} file of video ${video.uuid}`, lTags)

      await moveVideoSourceFile(source)
    }

    if (video.VideoFiles) {
      logger.debug(`Moving ${video.VideoFiles.length} web video files for video ${video.uuid}.`, lTags)

      await moveWebVideoFiles(video)
    }

    if (video.VideoStreamingPlaylists) {
      logger.debug(`Moving HLS playlist of ${video.uuid}.`, lTags)

      await moveHLSFiles(video)
    }

    const captions = await VideoCaptionModel.listVideoCaptions(video.id)
    if (captions.length !== 0) {
      logger.debug(`Moving ${captions.length} captions of ${video.uuid}.`, lTags)

      const hls = video.getHLSPlaylist()
      await moveCaptionFiles(captions, hls)
    }

    const pendingMove = await VideoJobInfoModel.decrease(video.uuid, 'pendingMove')

    logger.info(`Moved video ${video.uuid}. Checking pending move.`, lTags, { pendingMove })

    if (pendingMove === 0) {
      logger.info(`Running cleanup after moving files (video ${video.uuid} in job ${jobId})`, lTags)

      await doAfterLastMove(video)
    }
  } finally { // Error handling is managed by the job queue
    fileMutexReleaser()
  }
}

export async function onMoveVideoToStorageFailure (options: {
  videoUUID: string
  err: any
  lTags: LoggerTags
  moveToFailedState: (video: MVideoWithAllFiles) => Promise<void>
}) {
  const { videoUUID, err, lTags, moveToFailedState } = options

  const video = await VideoModel.loadWithFiles(videoUUID)
  if (!video) return

  logger.error(`Cannot move video ${video.url} storage.`, { err, ...lTags })

  await moveToFailedState(video)
  await VideoJobInfoModel.abortAllTasks(video.uuid, 'pendingMove')
}
