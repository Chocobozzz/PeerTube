import { FileStorage, MoveStoragePayload, VideoStateType } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { updateTorrentMetadata } from '@server/helpers/webtorrent.js'
import { P2P_MEDIA_LOADER_PEER_VERSION } from '@server/initializers/constants.js'
import { storeHLSFileFromFilename, storeOriginalVideoFile, storeWebVideoFile } from '@server/lib/object-storage/index.js'
import { getHLSDirectory, getHlsResolutionPlaylistFilename } from '@server/lib/paths.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { moveToFailedMoveToObjectStorageState, moveToNextState } from '@server/lib/video-state.js'
import { MStreamingPlaylistVideo, MVideo, MVideoFile, MVideoWithAllFiles } from '@server/types/models/index.js'
import { MVideoSource } from '@server/types/models/video/video-source.js'
import { Job } from 'bullmq'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { moveToJob, onMoveToStorageFailure } from './shared/move-video.js'

const lTagsBase = loggerTagsFactory('move-object-storage')

export async function processMoveToObjectStorage (job: Job) {
  const payload = job.data as MoveStoragePayload
  logger.info('Moving video %s to object storage in job %s.', payload.videoUUID, job.id)

  await moveToJob({
    jobId: job.id,
    videoUUID: payload.videoUUID,
    loggerTags: lTagsBase().tags,

    moveWebVideoFiles,
    moveHLSFiles,
    moveVideoSourceFile,
    doAfterLastMove: video => doAfterLastMove({ video, previousVideoState: payload.previousVideoState, isNewVideo: payload.isNewVideo }),
    moveToFailedState: moveToFailedMoveToObjectStorageState
  })
}

export async function onMoveToObjectStorageFailure (job: Job, err: any) {
  const payload = job.data as MoveStoragePayload

  await onMoveToStorageFailure({
    videoUUID: payload.videoUUID,
    err,
    lTags: lTagsBase(),
    moveToFailedState: moveToFailedMoveToObjectStorageState
  })
}

// ---------------------------------------------------------------------------

async function moveVideoSourceFile (source: MVideoSource) {
  if (source.storage !== FileStorage.FILE_SYSTEM) return

  const sourcePath = VideoPathManager.Instance.getFSOriginalVideoFilePath(source.keptOriginalFilename)
  const fileUrl = await storeOriginalVideoFile(sourcePath, source.keptOriginalFilename)

  source.storage = FileStorage.OBJECT_STORAGE
  source.fileUrl = fileUrl
  await source.save()

  logger.debug('Removing original video file ' + sourcePath + ' because it\'s now on object storage', lTagsBase())

  await remove(sourcePath)
}

async function moveWebVideoFiles (video: MVideoWithAllFiles) {
  for (const file of video.VideoFiles) {
    if (file.storage !== FileStorage.FILE_SYSTEM) continue

    const fileUrl = await storeWebVideoFile(video, file)

    const oldPath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, file)
    await onVideoFileMoved({ videoOrPlaylist: video, file, fileUrl, oldPath })
  }
}

async function moveHLSFiles (video: MVideoWithAllFiles) {
  for (const playlist of video.VideoStreamingPlaylists) {
    const playlistWithVideo = playlist.withVideo(video)

    for (const file of playlist.VideoFiles) {
      if (file.storage !== FileStorage.FILE_SYSTEM) continue

      // Resolution playlist
      const playlistFilename = getHlsResolutionPlaylistFilename(file.filename)
      await storeHLSFileFromFilename(playlistWithVideo, playlistFilename)

      // Resolution fragmented file
      const fileUrl = await storeHLSFileFromFilename(playlistWithVideo, file.filename)

      const oldPath = join(getHLSDirectory(video), file.filename)

      await onVideoFileMoved({ videoOrPlaylist: Object.assign(playlist, { Video: video }), file, fileUrl, oldPath })
    }
  }
}

async function onVideoFileMoved (options: {
  videoOrPlaylist: MVideo | MStreamingPlaylistVideo
  file: MVideoFile
  fileUrl: string
  oldPath: string
}) {
  const { videoOrPlaylist, file, fileUrl, oldPath } = options

  file.fileUrl = fileUrl
  file.storage = FileStorage.OBJECT_STORAGE

  await updateTorrentMetadata(videoOrPlaylist, file)
  await file.save()

  logger.debug('Removing %s because it\'s now on object storage', oldPath, lTagsBase())
  await remove(oldPath)
}

async function doAfterLastMove (options: {
  video: MVideoWithAllFiles
  previousVideoState: VideoStateType
  isNewVideo: boolean
}) {
  const { video, previousVideoState, isNewVideo } = options

  for (const playlist of video.VideoStreamingPlaylists) {
    if (playlist.storage === FileStorage.OBJECT_STORAGE) continue

    const playlistWithVideo = playlist.withVideo(video)

    playlist.playlistUrl = await storeHLSFileFromFilename(playlistWithVideo, playlist.playlistFilename)
    playlist.segmentsSha256Url = await storeHLSFileFromFilename(playlistWithVideo, playlist.segmentsSha256Filename)
    playlist.storage = FileStorage.OBJECT_STORAGE

    playlist.assignP2PMediaLoaderInfoHashes(video, playlist.VideoFiles)
    playlist.p2pMediaLoaderPeerVersion = P2P_MEDIA_LOADER_PEER_VERSION

    await playlist.save()
  }

  await remove(getHLSDirectory(video))
  await moveToNextState({ video, previousVideoState, isNewVideo })
}
