import { Job } from 'bull'
import { remove } from 'fs-extra'
import { join } from 'path'
import { logger } from '@server/helpers/logger'
import { updateTorrentMetadata } from '@server/helpers/webtorrent'
import { CONFIG } from '@server/initializers/config'
import { P2P_MEDIA_LOADER_PEER_VERSION } from '@server/initializers/constants'
import { storeHLSFile, storeWebTorrentFile } from '@server/lib/object-storage'
import { getHLSDirectory, getHlsResolutionPlaylistFilename } from '@server/lib/paths'
import { moveToFailedMoveToObjectStorageState, moveToNextState } from '@server/lib/video-state'
import { VideoModel } from '@server/models/video/video'
import { VideoJobInfoModel } from '@server/models/video/video-job-info'
import { MStreamingPlaylistVideo, MVideo, MVideoFile, MVideoWithAllFiles } from '@server/types/models'
import { MoveObjectStoragePayload, VideoStorage } from '@shared/models'

export async function processMoveToObjectStorage (job: Job) {
  const payload = job.data as MoveObjectStoragePayload
  logger.info('Moving video %s in job %d.', payload.videoUUID, job.id)

  const video = await VideoModel.loadWithFiles(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Can\'t process job %d, video does not exist.', job.id)
    return undefined
  }

  try {
    if (video.VideoFiles) {
      await moveWebTorrentFiles(video)
    }

    if (video.VideoStreamingPlaylists) {
      await moveHLSFiles(video)
    }

    const pendingMove = await VideoJobInfoModel.decrease(video.uuid, 'pendingMove')
    if (pendingMove === 0) {
      logger.info('Running cleanup after moving files to object storage (video %s in job %d)', video.uuid, job.id)
      await doAfterLastJob(video, payload.isNewVideo)
    }
  } catch (err) {
    logger.error('Cannot move video %s to object storage.', video.url, { err })

    await moveToFailedMoveToObjectStorageState(video)
    await VideoJobInfoModel.abortAllTasks(video.uuid, 'pendingMove')
  }

  return payload.videoUUID
}

// ---------------------------------------------------------------------------

async function moveWebTorrentFiles (video: MVideoWithAllFiles) {
  for (const file of video.VideoFiles) {
    if (file.storage !== VideoStorage.FILE_SYSTEM) continue

    const fileUrl = await storeWebTorrentFile(file.filename)

    const oldPath = join(CONFIG.STORAGE.VIDEOS_DIR, file.filename)
    await onFileMoved({ videoOrPlaylist: video, file, fileUrl, oldPath })
  }
}

async function moveHLSFiles (video: MVideoWithAllFiles) {
  for (const playlist of video.VideoStreamingPlaylists) {
    const playlistWithVideo = playlist.withVideo(video)

    for (const file of playlist.VideoFiles) {
      if (file.storage !== VideoStorage.FILE_SYSTEM) continue

      // Resolution playlist
      const playlistFilename = getHlsResolutionPlaylistFilename(file.filename)
      await storeHLSFile(playlistWithVideo, playlistFilename)

      // Resolution fragmented file
      const fileUrl = await storeHLSFile(playlistWithVideo, file.filename)

      const oldPath = join(getHLSDirectory(video), file.filename)

      await onFileMoved({ videoOrPlaylist: Object.assign(playlist, { Video: video }), file, fileUrl, oldPath })
    }
  }
}

async function doAfterLastJob (video: MVideoWithAllFiles, isNewVideo: boolean) {
  for (const playlist of video.VideoStreamingPlaylists) {
    if (playlist.storage === VideoStorage.OBJECT_STORAGE) continue

    const playlistWithVideo = playlist.withVideo(video)

    // Master playlist
    playlist.playlistUrl = await storeHLSFile(playlistWithVideo, playlist.playlistFilename)
    // Sha256 segments file
    playlist.segmentsSha256Url = await storeHLSFile(playlistWithVideo, playlist.segmentsSha256Filename)

    playlist.storage = VideoStorage.OBJECT_STORAGE

    playlist.assignP2PMediaLoaderInfoHashes(video, playlist.VideoFiles)
    playlist.p2pMediaLoaderPeerVersion = P2P_MEDIA_LOADER_PEER_VERSION

    await playlist.save()
  }

  // Remove empty hls video directory
  if (video.VideoStreamingPlaylists) {
    await remove(getHLSDirectory(video))
  }

  await moveToNextState(video, isNewVideo)
}

async function onFileMoved (options: {
  videoOrPlaylist: MVideo | MStreamingPlaylistVideo
  file: MVideoFile
  fileUrl: string
  oldPath: string
}) {
  const { videoOrPlaylist, file, fileUrl, oldPath } = options

  file.fileUrl = fileUrl
  file.storage = VideoStorage.OBJECT_STORAGE

  await updateTorrentMetadata(videoOrPlaylist, file)
  await file.save()

  logger.debug('Removing %s because it\'s now on object storage', oldPath)
  await remove(oldPath)
}
