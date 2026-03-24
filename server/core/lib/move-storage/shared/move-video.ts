import { FileStorage, FileStorageType } from '@peertube/peertube-models'
import { LoggerTags, logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { VideoSourceModel } from '@server/models/video/video-source.js'
import { VideoModel } from '@server/models/video/video.js'
import { MStreamingPlaylistVideoUUID, MVideo, MVideoCaption, MVideoWithAllFiles } from '@server/types/models/index.js'
import { MVideoSource } from '@server/types/models/video/video-source.js'

export async function moveVideoToStorage (options: {
  videoUUID: string
  loggerTags: LoggerTags['tags']

  targetStorage: FileStorageType

  moveWebVideoFiles: (video: MVideoWithAllFiles) => Promise<void>
  moveHLSFiles: (video: MVideoWithAllFiles) => Promise<void>
  moveVideoSourceFile: (source: MVideoSource) => Promise<void>
  moveCaptionFiles: (captions: MVideoCaption[], hls: MStreamingPlaylistVideoUUID) => Promise<void>
}) {
  const {
    loggerTags,
    videoUUID,
    moveVideoSourceFile,
    moveHLSFiles,
    moveWebVideoFiles,
    moveCaptionFiles,
    targetStorage
  } = options

  const lTagsBase = loggerTagsFactory(...loggerTags)

  const fileMutexReleaser = await VideoPathManager.Instance.lockFiles(videoUUID)

  const video = await VideoModel.loadWithFiles(videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info(`Can't move video ${videoUUID}, video does not exist.`, lTagsBase(videoUUID))
    fileMutexReleaser()
    return undefined
  }

  const lTags = lTagsBase(video.uuid, video.url)

  try {
    const { source, captions, hls, webFiles } = await filterVideoResourcesToBeMoved(video, targetStorage)

    if (captions.length !== 0) {
      logger.debug(`Moving ${captions.length} captions of ${video.uuid}.`, lTags)

      const hls = video.getHLSPlaylist()
      await moveCaptionFiles(captions, hls)
    }

    if (source) {
      logger.debug(`Moving video source ${source.keptOriginalFilename} file of video ${video.uuid}`, lTags)

      await moveVideoSourceFile(source)
    }

    if (webFiles.length !== 0) {
      logger.debug(`Moving ${webFiles.length} web video files for video ${video.uuid}.`, lTags)

      await moveWebVideoFiles(video)
    }

    if (hls) {
      logger.debug(`Moving HLS playlist of ${video.uuid}.`, lTags)

      await moveHLSFiles(video)
    }

    const pendingMove = await VideoJobInfoModel.decrease(video.uuid, 'pendingMove')

    logger.info(`Moved video ${video.uuid}. Remaining pending move: ${pendingMove}.`, lTags)
  } finally { // Error handling is managed by the job queue
    fileMutexReleaser()
  }
}

export async function onMoveVideoToStorageFailure (options: {
  videoUUID: string
  err: any
  loggerTags: LoggerTags['tags']
  moveToFailedState: (video: MVideoWithAllFiles) => Promise<void>
}) {
  const { videoUUID, err, loggerTags, moveToFailedState } = options

  const video = await VideoModel.loadWithFiles(videoUUID)
  if (!video) return

  logger.error(`Cannot move video ${video.url} storage.`, { err, tags: loggerTags })

  await moveToFailedState(video)
  await VideoJobInfoModel.abortAllTasks(video.uuid, 'pendingMove')
}

export async function filterVideoResourcesToBeMoved (videoArg: MVideo, targetStorage: FileStorageType) {
  const video = await VideoModel.loadFull(videoArg.id)
  const captions = await VideoCaptionModel.listVideoCaptions(video.id)
  const source = await VideoSourceModel.loadLatest(video.id)

  const hls = video.getHLSPlaylist()

  const moveHLS = hls && (hls.storage !== targetStorage || hls.VideoFiles.some(f => f.storage !== targetStorage))

  return {
    source: source?.keptOriginalFilename && source.storage !== targetStorage
      ? source
      : undefined,

    hls: moveHLS
      ? hls
      : undefined,

    webFiles: video.VideoFiles.filter(f => f.storage !== targetStorage),
    captions: captions.filter(c => {
      if (c.storage !== targetStorage) return true

      if (hls) {
        if (targetStorage === FileStorage.OBJECT_STORAGE) return !c.m3u8Filename || !c.m3u8Url
        else if (targetStorage === FileStorage.FILE_SYSTEM) return !c.m3u8Filename || c.m3u8Url
      }

      return false
    })
  }
}

export async function hasVideoResourcesToBeMoved (video: MVideo, targetStorage: FileStorageType) {
  const { captions, hls, source, webFiles } = await filterVideoResourcesToBeMoved(video, targetStorage)

  return captions.length !== 0 || !!hls || !!source || webFiles.length !== 0
}
