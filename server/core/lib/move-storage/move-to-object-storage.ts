import { FileStorage, VideoStateType } from '@peertube/peertube-models'
import { logger, LoggerTags, loggerTagsFactory } from '@server/helpers/logger.js'
import { P2P_MEDIA_LOADER_PEER_VERSION } from '@server/initializers/constants.js'
import { buildCaptionM3U8Content } from '@server/lib/hls.js'
import {
  storeHLSFileFromContent,
  storeHLSFileFromFilename,
  storeOriginalVideoFile,
  storeVideoCaption,
  storeWebVideoFile
} from '@server/lib/object-storage/index.js'
import { getHLSDirectory, getHLSResolutionPlaylistFilename } from '@server/lib/paths.js'
import { updateHLSMasterOnCaptionChange } from '@server/lib/video-captions.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { moveToFailedMoveToObjectStorageState, moveToNextState } from '@server/lib/video-state.js'
import { updateTorrentMetadata } from '@server/lib/webtorrent.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoModel } from '@server/models/video/video.js'
import { MStreamingPlaylistVideo, MVideo, MVideoCaption, MVideoFile, MVideoWithAllFiles } from '@server/types/models/index.js'
import { MVideoSource } from '@server/types/models/video/video-source.js'
import { remove } from 'fs-extra/esm'
import { rmdir } from 'fs/promises'
import { join } from 'path'
import { federateVideoIfNeeded } from '../activitypub/videos/federate.js'
import { moveCaptionToStorage } from './shared/move-caption.js'
import { moveVideoToStorage, onMoveVideoToStorageFailure } from './shared/move-video.js'

const lTagsBase = loggerTagsFactory('object-storage', 'move-object-storage')

export async function moveVideoToObjectStorage (options: {
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

    targetStorage: FileStorage.OBJECT_STORAGE,

    moveWebVideoFiles,
    moveHLSFiles,
    moveVideoSourceFile,
    moveCaptionFiles
  })

  if (options.moveVideoState) {
    await moveToNextState({ video: { uuid: videoUUID }, ...moveVideoState })
  } else {
    const videoFull = await VideoModel.loadFull(videoUUID)
    await federateVideoIfNeeded(videoFull, false, undefined)
  }
}

export function moveCaptionToObjectStorage (options: {
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

export async function onMoveVideoToObjectStorageFailure (options: {
  videoUUID: string
  loggerTags: LoggerTags['tags']
  err: Error
}) {
  const { videoUUID, err, loggerTags } = options

  await onMoveVideoToStorageFailure({
    videoUUID,
    err,
    loggerTags: [ ...lTagsBase().tags, ...loggerTags ],
    moveToFailedState: moveToFailedMoveToObjectStorageState
  })
}

// ---------------------------------------------------------------------------

async function moveVideoSourceFile (source: MVideoSource) {
  if (source.storage !== FileStorage.FILE_SYSTEM) return

  const sourcePath = VideoPathManager.Instance.getFSOriginalVideoFilePath(source.keptOriginalFilename)
  await storeOriginalVideoFile(sourcePath, source.keptOriginalFilename)

  source.storage = FileStorage.OBJECT_STORAGE
  await source.save()

  logger.debug('Removing original video file ' + sourcePath + ' because it\'s now on object storage', lTagsBase())

  await remove(sourcePath)
}

// ---------------------------------------------------------------------------

async function moveCaptionFiles (captions: MVideoCaption[], hls: MStreamingPlaylistVideo) {
  let hlsUpdated = false

  for (const caption of captions) {
    if (caption.storage === FileStorage.FILE_SYSTEM) {
      const captionPath = caption.getFSFilePath()

      await storeVideoCaption(captionPath, caption.filename)
      // Assign new values before building the m3u8 file
      caption.storage = FileStorage.OBJECT_STORAGE

      await caption.save()

      logger.debug(`Removing video caption file ${captionPath} because it's now on object storage`, lTagsBase())
      await remove(captionPath)
    }

    if (hls) {
      hlsUpdated = true

      const m3u8PathToRemove = caption.getFSM3U8Path(hls.Video)

      // Caption file URL has been updated, so we must also update the HLS caption playlist
      const content = buildCaptionM3U8Content({ video: hls.Video, caption })

      caption.m3u8Filename = VideoCaptionModel.generateM3U8Filename(caption.filename)

      await storeHLSFileFromContent({
        video: hls.Video,
        pathOrFilename: caption.m3u8Filename,
        content
      })

      await caption.save()

      if (m3u8PathToRemove) {
        logger.debug(`Removing video caption playlist file ${m3u8PathToRemove} because it's now on object storage`, lTagsBase())
        await remove(m3u8PathToRemove)
      }
    }
  }

  if (hlsUpdated) {
    await updateHLSMasterOnCaptionChange(hls.Video, hls)
  }
}

// ---------------------------------------------------------------------------

async function moveWebVideoFiles (video: MVideoWithAllFiles) {
  for (const file of video.VideoFiles) {
    if (file.storage !== FileStorage.FILE_SYSTEM) continue

    await storeWebVideoFile(video, file)

    const oldPath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, file)
    await onVideoFileMoved({ videoOrPlaylist: video, file, oldPath })
  }
}

async function moveHLSFiles (video: MVideoWithAllFiles) {
  for (const playlist of video.VideoStreamingPlaylists) {
    let updatedFile = false

    for (const file of playlist.VideoFiles) {
      if (file.storage !== FileStorage.FILE_SYSTEM) continue

      updatedFile = true

      // Resolution playlist
      const playlistFilename = getHLSResolutionPlaylistFilename(file.filename)
      await storeHLSFileFromFilename(video, playlistFilename)

      // Resolution fragmented file
      await storeHLSFileFromFilename(video, file.filename)

      const oldPath = join(getHLSDirectory(video), file.filename)

      await onVideoFileMoved({ videoOrPlaylist: Object.assign(playlist, { Video: video }), file, oldPath })

      await remove(join(getHLSDirectory(video), playlistFilename))
    }

    if (playlist.storage === FileStorage.FILE_SYSTEM) {
      await storeHLSFileFromFilename(video, playlist.playlistFilename)
      await storeHLSFileFromFilename(video, playlist.segmentsSha256Filename)
      playlist.storage = FileStorage.OBJECT_STORAGE

      await playlist.save()

      await remove(join(getHLSDirectory(video), playlist.playlistFilename))
      await remove(join(getHLSDirectory(video), playlist.segmentsSha256Filename))
    }

    if (updatedFile === true) {
      playlist.assignP2PMediaLoaderInfoHashes(video, playlist.VideoFiles)
      playlist.p2pMediaLoaderPeerVersion = P2P_MEDIA_LOADER_PEER_VERSION

      await playlist.save()
    }
  }

  try {
    await rmdir(getHLSDirectory(video))
  } catch {
    // Nothing to do, directory may be not empty if there is a transcoding in progress
  }
}

async function onVideoFileMoved (options: {
  videoOrPlaylist: MVideo | MStreamingPlaylistVideo
  file: MVideoFile
  oldPath: string
}) {
  const { videoOrPlaylist, file, oldPath } = options

  file.storage = FileStorage.OBJECT_STORAGE

  await updateTorrentMetadata(videoOrPlaylist, file)
  await file.save()

  logger.debug('Removing %s because it\'s now on object storage', oldPath, lTagsBase())
  await remove(oldPath)
}
