import { FileStorage, VideoStateType } from '@peertube/peertube-models'
import { logger, LoggerTags, loggerTagsFactory } from '@server/helpers/logger.js'
import { P2P_MEDIA_LOADER_PEER_VERSION } from '@server/initializers/constants.js'
import {
  makeCaptionFileAvailable,
  makeHLSFileAvailable,
  makeOriginalFileAvailable,
  makeWebVideoFileAvailable,
  removeCaptionObjectStorage,
  removeHLSFileObjectStorageByFilename,
  removeOriginalFileObjectStorage,
  removeWebVideoObjectStorage
} from '@server/lib/object-storage/index.js'
import { getHLSDirectory, getHLSResolutionPlaylistFilename } from '@server/lib/paths.js'
import { updateHLSMasterOnCaptionChange, upsertCaptionPlaylistOnFS } from '@server/lib/video-captions.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { moveToFailedMoveToFileSystemState, moveToNextState } from '@server/lib/video-state.js'
import { updateTorrentMetadata } from '@server/lib/webtorrent.js'
import { VideoModel } from '@server/models/video/video.js'
import { MStreamingPlaylistVideo, MVideo, MVideoCaption, MVideoFile, MVideoWithAllFiles } from '@server/types/models/index.js'
import { MVideoSource } from '@server/types/models/video/video-source.js'
import { join } from 'path'
import { moveCaptionToStorage } from './shared/move-caption.js'
import { moveVideoToStorage, onMoveVideoToStorageFailure } from './shared/move-video.js'

const lTagsBase = loggerTagsFactory('move-file-system')

export async function moveVideoToFS (options: {
  videoUUID: string

  moveVideoState?: {
    isNewVideo: boolean
    previousVideoState: VideoStateType
  }

  loggerTags: LoggerTags['tags']
}) {
  const { videoUUID, moveVideoState, loggerTags } = options

  await moveVideoToStorage({
    videoUUID,
    loggerTags: [ ...lTagsBase().tags, ...loggerTags ],

    targetStorage: FileStorage.FILE_SYSTEM,

    moveWebVideoFiles,
    moveHLSFiles,
    moveVideoSourceFile,
    moveCaptionFiles
  })

  if (options.moveVideoState) {
    const video = await VideoModel.load(videoUUID)

    await moveToNextState({ video, ...moveVideoState })
  }
}

export function moveCaptionToFS (options: {
  captionId: number
  loggerTags: LoggerTags['tags']
}) {
  const { captionId, loggerTags } = options

  return moveCaptionToStorage({
    captionId,
    loggerTags: [ ...lTagsBase().tags, ...loggerTags ],
    moveCaptionFiles
  })
}

export async function onMoveVideoToFSFailure (options: {
  videoUUID: string
  loggerTags: LoggerTags['tags']
  err: Error
}) {
  const { videoUUID, err, loggerTags } = options

  await onMoveVideoToStorageFailure({
    videoUUID,
    err,
    loggerTags: [ ...lTagsBase().tags, ...loggerTags ],
    moveToFailedState: moveToFailedMoveToFileSystemState
  })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function moveVideoSourceFile (source: MVideoSource) {
  if (source.storage === FileStorage.FILE_SYSTEM) return

  await makeOriginalFileAvailable(
    source.keptOriginalFilename,
    VideoPathManager.Instance.getFSOriginalVideoFilePath(source.keptOriginalFilename)
  )

  const oldFileUrl = source.fileUrl

  source.fileUrl = null
  source.storage = FileStorage.FILE_SYSTEM
  await source.save()

  logger.debug('Removing original video file %s because it\'s now on file system', oldFileUrl, lTagsBase())

  await removeOriginalFileObjectStorage(source)
}

async function moveWebVideoFiles (video: MVideoWithAllFiles) {
  for (const file of video.VideoFiles) {
    if (file.storage === FileStorage.FILE_SYSTEM) continue

    await makeWebVideoFileAvailable(file.filename, VideoPathManager.Instance.getFSVideoFileOutputPath(video, file))
    await onVideoFileMoved({
      videoOrPlaylist: video,
      file,
      objetStorageRemover: () => removeWebVideoObjectStorage(file)
    })
  }
}

async function moveHLSFiles (video: MVideoWithAllFiles) {
  for (const playlist of video.VideoStreamingPlaylists) {
    const playlistWithVideo = playlist.withVideo(video)

    let updatedFile = false

    for (const file of playlist.VideoFiles) {
      if (file.storage === FileStorage.FILE_SYSTEM) continue

      updatedFile = true

      // Resolution playlist
      const playlistFilename = getHLSResolutionPlaylistFilename(file.filename)
      await makeHLSFileAvailable(playlistWithVideo, playlistFilename, join(getHLSDirectory(video), playlistFilename))
      await makeHLSFileAvailable(playlistWithVideo, file.filename, join(getHLSDirectory(video), file.filename))

      await onVideoFileMoved({
        videoOrPlaylist: playlistWithVideo,
        file,
        objetStorageRemover: async () => {
          await removeHLSFileObjectStorageByFilename(playlistWithVideo, playlistFilename)
          await removeHLSFileObjectStorageByFilename(playlistWithVideo, file.filename)
        }
      })
    }

    if (playlistWithVideo.storage !== FileStorage.FILE_SYSTEM) {
      await makeHLSFileAvailable(playlistWithVideo, playlist.playlistFilename, join(getHLSDirectory(video), playlist.playlistFilename))

      await makeHLSFileAvailable(
        playlistWithVideo,
        playlist.segmentsSha256Filename,
        join(getHLSDirectory(video), playlist.segmentsSha256Filename)
      )

      playlist.playlistUrl = null
      playlist.segmentsSha256Url = null
      playlist.storage = FileStorage.FILE_SYSTEM

      await playlist.save()

      await removeHLSFileObjectStorageByFilename(playlistWithVideo, playlist.playlistFilename)
      await removeHLSFileObjectStorageByFilename(playlistWithVideo, playlist.segmentsSha256Filename)
    }

    if (updatedFile === true) {
      playlist.assignP2PMediaLoaderInfoHashes(video, playlist.VideoFiles)
      playlist.p2pMediaLoaderPeerVersion = P2P_MEDIA_LOADER_PEER_VERSION

      await playlist.save()
    }
  }
}

async function onVideoFileMoved (options: {
  videoOrPlaylist: MVideo | MStreamingPlaylistVideo
  file: MVideoFile
  objetStorageRemover: () => Promise<any>
}) {
  const { videoOrPlaylist, file, objetStorageRemover } = options

  const oldFileUrl = file.fileUrl

  file.fileUrl = null
  file.storage = FileStorage.FILE_SYSTEM

  await updateTorrentMetadata(videoOrPlaylist, file)
  await file.save()

  logger.debug('Removing web video file %s because it\'s now on file system', oldFileUrl, lTagsBase())
  await objetStorageRemover()
}

// ---------------------------------------------------------------------------

async function moveCaptionFiles (captions: MVideoCaption[], hls: MStreamingPlaylistVideo) {
  let hlsUpdated = false

  for (const caption of captions) {
    if (caption.storage === FileStorage.OBJECT_STORAGE) {
      const oldFileUrl = caption.fileUrl

      await makeCaptionFileAvailable(caption.filename, caption.getFSFilePath())

      // Assign new values before building the m3u8 file
      caption.fileUrl = null
      caption.storage = FileStorage.FILE_SYSTEM

      await caption.save()

      logger.debug('Removing caption file %s because it\'s now on file system', oldFileUrl, lTagsBase())
      await removeCaptionObjectStorage(caption)
    }

    if (hls && (!caption.m3u8Filename || caption.m3u8Url)) {
      hlsUpdated = true

      const oldM3U8Url = caption.m3u8Url
      const oldM3U8Filename = caption.m3u8Filename

      // Caption link has been updated, so we must also update the HLS caption playlist
      caption.m3u8Filename = await upsertCaptionPlaylistOnFS(caption, hls.Video)
      caption.m3u8Url = null

      await caption.save()

      if (oldM3U8Url) {
        logger.debug(`Removing video caption playlist file ${oldM3U8Url} because it's now on file system`, lTagsBase())

        await removeHLSFileObjectStorageByFilename(hls, oldM3U8Filename)
      }
    }
  }

  if (hlsUpdated) {
    await updateHLSMasterOnCaptionChange(hls.Video, hls)
  }
}
