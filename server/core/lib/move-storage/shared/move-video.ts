import { FileStorage, FileStorageType, VideoStateType } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { P2P_MEDIA_LOADER_PEER_VERSION } from '@server/initializers/constants.js'
import { buildCaptionM3U8Content } from '@server/lib/hls.js'
import { isObjectStorageEnabledFor, ObjectStorageSectionType } from '@server/lib/object-storage/config.js'
import {
  makeCaptionFileAvailable,
  makeHLSFileAvailable,
  makeOriginalFileAvailable,
  makeWebVideoFileAvailable,
  removeCaptionObjectStorage,
  removeHLSFileObjectStorageByFilename,
  removeOriginalFileObjectStorage,
  removeWebVideoObjectStorage,
  storeHLSFileFromContent,
  storeHLSFileFromFilename,
  storeOriginalVideoFile,
  storeVideoCaption,
  storeWebVideoFile
} from '@server/lib/object-storage/index.js'
import { getFSTorrentFilePath, getHLSDirectory, getHLSResolutionPlaylistFilename } from '@server/lib/paths.js'
import { updateHLSMasterOnCaptionChange, upsertCaptionPlaylistOnFS } from '@server/lib/video-captions.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { updateTorrentForFileAndSave } from '@server/lib/webtorrent.js'
import { StoryboardModel } from '@server/models/video/storyboard.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import { VideoSourceModel } from '@server/models/video/video-source.js'
import { VideoModel } from '@server/models/video/video.js'
import { MStreamingPlaylistVideo, MVideo, MVideoCaption, MVideoFile, MVideoWithAllFiles } from '@server/types/models/index.js'
import { MVideoSource } from '@server/types/models/video/video-source.js'
import { remove } from 'fs-extra/esm'
import { rmdir } from 'fs/promises'
import { join } from 'path'
import { moveCommonFile } from './move-common-file.js'

const logger = createLogger()

export async function moveVideoToStorage (options: {
  videoUUID: string

  targetStorage: FileStorageType
}) {
  const { videoUUID, targetStorage } = options

  const fileMutexReleaser = await VideoPathManager.Instance.lockFiles(videoUUID)

  const video = await VideoModel.loadWithFiles(videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info(`Can't move video ${videoUUID}, video does not exist.`)
    fileMutexReleaser()
    return undefined
  }

  try {
    const { source, captions, hls, webFiles, torrents, thumbnails, storyboard } = await filterVideoResourcesToBeMoved(
      video,
      targetStorage
    )

    if (captions.length !== 0) {
      logger.debug(`Moving ${captions.length} captions of ${video.uuid}.`)

      await moveCaptionFiles(captions, video.getHLSPlaylist(), targetStorage)
    }

    if (source) {
      logger.debug(`Moving video source ${source.keptOriginalFilename} file of video ${video.uuid}`)

      await moveVideoSourceFile(source, targetStorage)
    }

    if (webFiles.length !== 0) {
      logger.debug(`Moving ${webFiles.length} web video files for video ${video.uuid}.`)

      await moveWebVideoFiles(video, targetStorage)
    }

    if (hls) {
      logger.debug(`Moving HLS playlist of ${video.uuid}.`)

      await moveHLSFiles(video, targetStorage)
    }

    // After the video files: moving them rewrites the torrents under a new filename
    // So read the filenames of the video files that the steps above just updated
    if (torrents.length !== 0) {
      logger.debug(`Moving ${torrents.length} torrents of ${video.uuid}.`)

      for (const file of listTorrentFilesOf(video)) {
        if (file.torrentStorage === targetStorage) continue

        await moveCommonFile({ type: 'torrents', filename: file.torrentFilename, fsPath: getFSTorrentFilePath(file), targetStorage })
      }
    }

    if (thumbnails.length !== 0) {
      logger.debug(`Moving ${thumbnails.length} thumbnails of ${video.uuid}.`)

      for (const thumbnail of thumbnails) {
        await moveCommonFile({ type: 'thumbnails', filename: thumbnail.filename, fsPath: thumbnail.getFSPath(), targetStorage })
      }
    }

    if (storyboard) {
      logger.debug(`Moving storyboard of ${video.uuid}.`)

      await moveCommonFile({ type: 'storyboards', filename: storyboard.filename, fsPath: storyboard.getFSPath(), targetStorage })
    }

    const pendingMove = await VideoJobInfoModel.decrease(video.uuid, 'pendingMove')

    logger.info(`Moved video ${video.uuid}. Remaining pending move: ${pendingMove}.`)
  } finally { // Error handling is managed by the job queue
    fileMutexReleaser()
  }
}

export async function onMoveVideoToStorageFailure (options: {
  videoUUID: string
  err: any
  moveVideoState: { previousVideoState: VideoStateType } | undefined
  moveToFailedState: (video: MVideoWithAllFiles) => Promise<void>
}) {
  const { videoUUID, err, moveVideoState, moveToFailedState } = options

  const video = await VideoModel.loadWithFiles(videoUUID)
  if (!video) return

  logger.error(`Cannot move video ${video.url} storage.`, { err })

  // The job did not take the video out of its state (published for example), so keep it there
  if (moveVideoState) await moveToFailedState(video)

  await VideoJobInfoModel.abortAllTasks(video.uuid, 'pendingMove')
}

export async function filterVideoResourcesToBeMoved (videoArg: MVideo, targetStorage: FileStorageType) {
  const video = await VideoModel.loadFull(videoArg.id)
  const captions = await VideoCaptionModel.listVideoCaptions(video.id)
  const source = await VideoSourceModel.loadLatest(video.id)
  const storyboard = await StoryboardModel.loadByVideo(video.id)

  const hls = video.getHLSPlaylist()

  const moveHLS = hls && (hls.storage !== targetStorage || hls.VideoFiles.some(f => f.storage !== targetStorage))

  const allFiles = [ ...video.VideoFiles, ...(hls?.VideoFiles || []) ]

  // Only move a file type the admin opted into, but always allow moving it back to the file system
  return {
    source: canMoveTo('original_video_files', targetStorage) && source?.keptOriginalFilename && source.storage !== targetStorage
      ? source
      : undefined,

    hls: canMoveTo('streaming_playlists', targetStorage) && moveHLS
      ? hls
      : undefined,

    webFiles: canMoveTo('web_videos', targetStorage)
      ? video.VideoFiles.filter(f => f.storage !== targetStorage)
      : [],

    captions: canMoveTo('captions', targetStorage)
      ? captions.filter(c => {
        if (c.storage !== targetStorage) return true
        if (hls && !c.m3u8Filename) return true

        return false
      })
      : [],

    torrents: canMoveTo('torrents', targetStorage)
      ? allFiles.filter(f => f.torrentFilename && f.torrentStorage !== targetStorage)
      : [],

    thumbnails: canMoveTo('thumbnails', targetStorage)
      ? (video.Thumbnails || []).filter(t => t.isLocal() && t.storage !== targetStorage)
      : [],

    storyboard: canMoveTo('storyboards', targetStorage) && storyboard?.isLocal() && storyboard.storage !== targetStorage
      ? storyboard
      : undefined
  }
}

export async function checkVideoResourcesToBeMoved (video: MVideo, targetStorage: FileStorageType) {
  const { captions, hls, source, webFiles, torrents, thumbnails, storyboard } = await filterVideoResourcesToBeMoved(
    video,
    targetStorage
  )

  return {
    // The video must be taken out of its state while these files are moved
    videoFiles: captions.length !== 0 || !!hls || !!source || webFiles.length !== 0,

    // These ones can be moved while the video stays published
    otherFiles: torrents.length !== 0 || thumbnails.length !== 0 || !!storyboard
  }
}

// ---------------------------------------------------------------------------
// Video files movers: unlike torrents/thumbnails/storyboards, these need more than a flat store/remove
// ---------------------------------------------------------------------------

async function moveVideoSourceFile (source: MVideoSource, targetStorage: FileStorageType) {
  if (source.storage === targetStorage) return

  const sourcePath = VideoPathManager.Instance.getFSOriginalVideoFilePath(source.keptOriginalFilename)

  if (targetStorage === FileStorage.OBJECT_STORAGE) {
    await storeOriginalVideoFile(sourcePath, source.keptOriginalFilename)
    source.storage = FileStorage.OBJECT_STORAGE
    await source.save()

    logger.debug(`Removing original video file ${sourcePath} because it's now on object storage`)
    await remove(sourcePath)
  } else {
    await makeOriginalFileAvailable(source.keptOriginalFilename, sourcePath)
    source.storage = FileStorage.FILE_SYSTEM
    await source.save()

    logger.debug(`Removing original video file ${source.keptOriginalFilename} because it's now on file system`)
    await removeOriginalFileObjectStorage(source)
  }
}

async function moveWebVideoFiles (video: MVideoWithAllFiles, targetStorage: FileStorageType) {
  for (const file of video.VideoFiles) {
    if (file.storage === targetStorage) continue

    const fsPath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, file)

    if (targetStorage === FileStorage.OBJECT_STORAGE) {
      await storeWebVideoFile(video, file)

      await onVideoFileMoved({ videoOrPlaylist: video, file, targetStorage, cleanup: () => remove(fsPath) })
    } else {
      await makeWebVideoFileAvailable(file.filename, fsPath)

      await onVideoFileMoved({ videoOrPlaylist: video, file, targetStorage, cleanup: () => removeWebVideoObjectStorage(file) })
    }
  }
}

async function moveHLSFiles (video: MVideoWithAllFiles, targetStorage: FileStorageType) {
  for (const playlist of video.VideoStreamingPlaylists) {
    let updatedFile = false

    for (const file of playlist.VideoFiles) {
      if (file.storage === targetStorage) continue

      updatedFile = true

      const playlistFilename = getHLSResolutionPlaylistFilename(file.filename)
      const playlistPath = join(getHLSDirectory(video), playlistFilename)
      const filePath = join(getHLSDirectory(video), file.filename)

      if (targetStorage === FileStorage.OBJECT_STORAGE) {
        await storeHLSFileFromFilename(video, playlistFilename)
        await storeHLSFileFromFilename(video, file.filename)

        await onVideoFileMoved({
          videoOrPlaylist: playlist.withVideo(video),
          file,
          targetStorage,
          cleanup: () => remove(filePath)
        })

        await remove(playlistPath)
      } else {
        await makeHLSFileAvailable(video, playlistFilename, playlistPath)
        await makeHLSFileAvailable(video, file.filename, filePath)

        await onVideoFileMoved({
          videoOrPlaylist: playlist.withVideo(video),
          file,
          targetStorage,
          cleanup: async () => {
            await removeHLSFileObjectStorageByFilename(video, playlistFilename)
            await removeHLSFileObjectStorageByFilename(video, file.filename)
          }
        })
      }
    }

    if (playlist.storage !== targetStorage) {
      const masterPlaylistPath = join(getHLSDirectory(video), playlist.playlistFilename)
      const shaPath = join(getHLSDirectory(video), playlist.segmentsSha256Filename)

      if (targetStorage === FileStorage.OBJECT_STORAGE) {
        await storeHLSFileFromFilename(video, playlist.playlistFilename)
        await storeHLSFileFromFilename(video, playlist.segmentsSha256Filename)

        playlist.storage = FileStorage.OBJECT_STORAGE
        await playlist.save()

        await remove(masterPlaylistPath)
        await remove(shaPath)
      } else {
        await makeHLSFileAvailable(video, playlist.playlistFilename, masterPlaylistPath)
        await makeHLSFileAvailable(video, playlist.segmentsSha256Filename, shaPath)

        playlist.storage = FileStorage.FILE_SYSTEM
        await playlist.save()

        await removeHLSFileObjectStorageByFilename(video, playlist.playlistFilename)
        await removeHLSFileObjectStorageByFilename(video, playlist.segmentsSha256Filename)
      }
    }

    if (updatedFile === true) {
      await playlist.buildAndSetInfoHashes(video, playlist.VideoFiles)
      playlist.p2pMediaLoaderPeerVersion = P2P_MEDIA_LOADER_PEER_VERSION

      await playlist.save()
    }
  }

  if (targetStorage === FileStorage.OBJECT_STORAGE) {
    try {
      await rmdir(getHLSDirectory(video))
    } catch {
      // Nothing to do, directory may be not empty if there is a transcoding in progress
    }
  }
}

async function onVideoFileMoved (options: {
  videoOrPlaylist: MVideo | MStreamingPlaylistVideo
  file: MVideoFile
  targetStorage: FileStorageType
  cleanup: () => Promise<any>
}) {
  const { videoOrPlaylist, file, targetStorage, cleanup } = options

  file.storage = targetStorage
  await updateTorrentForFileAndSave(videoOrPlaylist, file)

  await cleanup()
}

// Also called directly to move a single caption (see move-caption.ts)
export async function moveCaptionFiles (captions: MVideoCaption[], hls: MStreamingPlaylistVideo, targetStorage: FileStorageType) {
  let hlsUpdated = false

  for (const caption of captions) {
    if (caption.storage !== targetStorage) {
      if (targetStorage === FileStorage.OBJECT_STORAGE) {
        const captionPath = caption.getFSFilePath()
        await storeVideoCaption(captionPath, caption.filename)

        caption.storage = FileStorage.OBJECT_STORAGE
        await caption.save()

        logger.debug(`Removing video caption file ${captionPath} because it's now on object storage`)
        await remove(captionPath)
      } else {
        await makeCaptionFileAvailable(caption.filename, caption.getFSFilePath())

        caption.storage = FileStorage.FILE_SYSTEM
        await caption.save()

        logger.debug(`Removing video caption file ${caption.filename} because it's now on file system`)
        await removeCaptionObjectStorage(caption)
      }
    }

    if (hls) {
      hlsUpdated = true

      if (targetStorage === FileStorage.OBJECT_STORAGE) {
        const m3u8PathToRemove = caption.getFSM3U8Path(hls.Video)

        // Caption file URL has been updated, so we must also update the HLS caption playlist
        const content = buildCaptionM3U8Content({ video: hls.Video, caption })

        caption.m3u8Filename = VideoCaptionModel.generateM3U8Filename(caption.filename)

        await storeHLSFileFromContent({ video: hls.Video, pathOrFilename: caption.m3u8Filename, content })
        await caption.save()

        if (m3u8PathToRemove) {
          logger.debug(`Removing video caption playlist file ${m3u8PathToRemove} because it's now on object storage`)
          await remove(m3u8PathToRemove)
        }
      } else {
        const oldM3U8Filename = caption.m3u8Filename

        // Caption link has been updated, so we must also update the HLS caption playlist
        caption.m3u8Filename = await upsertCaptionPlaylistOnFS(caption, hls.Video)
        await caption.save()

        if (oldM3U8Filename) {
          logger.debug(`Removing video caption playlist file ${oldM3U8Filename} because it's now on file system`)
          await removeHLSFileObjectStorageByFilename(hls.Video, oldM3U8Filename)
        }
      }
    }
  }

  if (hlsUpdated) {
    await updateHLSMasterOnCaptionChange(hls.Video, hls)
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function listTorrentFilesOf (video: MVideoWithAllFiles) {
  return [ ...video.VideoFiles, ...video.VideoStreamingPlaylists.flatMap(p => p.VideoFiles || []) ]
    .filter(f => !!f.torrentFilename)
}

function canMoveTo (type: ObjectStorageSectionType, targetStorage: FileStorageType) {
  if (targetStorage === FileStorage.FILE_SYSTEM) return true

  return isObjectStorageEnabledFor(type)
}
