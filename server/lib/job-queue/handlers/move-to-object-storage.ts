import * as Bull from 'bull'
import { remove } from 'fs-extra'
import { join } from 'path'
import { logger } from '@server/helpers/logger'
import { createTorrentAndSetInfoHash } from '@server/helpers/webtorrent'
import { CONFIG } from '@server/initializers/config'
import { HLS_STREAMING_PLAYLIST_DIRECTORY } from '@server/initializers/constants'
import { storeHLSFile, storeWebTorrentFile } from '@server/lib/object-storage'
import { getHLSDirectory, getHlsResolutionPlaylistFilename } from '@server/lib/video-paths'
import { moveToNextState } from '@server/lib/video-state'
import { VideoModel } from '@server/models/video/video'
import { VideoJobInfoModel } from '@server/models/video/video-job-info'
import { MVideoFile, MVideoWithAllFiles } from '@server/types/models'
import { MoveObjectStoragePayload, VideoStorage } from '../../../../shared'

export async function processMoveToObjectStorage (job: Bull.Job) {
  const payload = job.data as MoveObjectStoragePayload
  logger.info('Moving video %s in job %d.', payload.videoUUID, job.id)

  const video = await VideoModel.loadWithFiles(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Can\'t process job %d, video does not exist.', job.id)
    return undefined
  }

  if (video.VideoFiles) {
    await moveWebTorrentFiles(video)
  }

  if (CONFIG.TRANSCODING.HLS.ENABLED && video.VideoStreamingPlaylists) {
    await moveHLSFiles(video)
  }

  const pendingMove = await VideoJobInfoModel.decrease(video.uuid, 'pendingMove')
  if (pendingMove === 0) {
    logger.info('Running cleanup after moving files to object storage (video %s in job %d)', video.uuid, job.id)
    await doAfterLastJob(video)
  }

  return payload.videoUUID
}

// ---------------------------------------------------------------------------

async function moveWebTorrentFiles (video: MVideoWithAllFiles) {
  for (const file of video.VideoFiles) {
    if (file.storage !== VideoStorage.LOCAL) continue

    const fileUrl = await storeWebTorrentFile(file.filename)

    const oldPath = join(CONFIG.STORAGE.VIDEOS_DIR, file.filename)
    await onFileMoved({ video, file, fileUrl, oldPath })
  }
}

async function moveHLSFiles (video: MVideoWithAllFiles) {
  for (const playlist of video.VideoStreamingPlaylists) {

    for (const file of playlist.VideoFiles) {
      if (file.storage !== VideoStorage.LOCAL) continue

      // Resolution playlist
      const playlistFilename = getHlsResolutionPlaylistFilename(file.filename)
      await storeHLSFile(playlist, video, playlistFilename)

      // Resolution fragmented file
      const fileUrl = await storeHLSFile(playlist, video, file.filename)

      const oldPath = join(getHLSDirectory(video), file.filename)

      await onFileMoved({ video, file, fileUrl, oldPath })
    }
  }
}

async function doAfterLastJob (video: MVideoWithAllFiles) {
  for (const playlist of video.VideoStreamingPlaylists) {
    // Master playlist
    playlist.playlistUrl = await storeHLSFile(playlist, video, playlist.playlistFilename)
    // Sha256 segments file
    playlist.segmentsSha256Url = await storeHLSFile(playlist, video, playlist.segmentsSha256Filename)

    playlist.storage = VideoStorage.OBJECT_STORAGE

    await playlist.save()
  }

  // Remove empty hls video directory
  if (video.VideoStreamingPlaylists) {
    await remove(join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid))
  }

  await moveToNextState(video)
}

async function onFileMoved (options: {
  video: MVideoWithAllFiles
  file: MVideoFile
  fileUrl: string
  oldPath: string
}) {
  const { video, file, fileUrl, oldPath } = options

  file.fileUrl = fileUrl
  file.storage = VideoStorage.OBJECT_STORAGE

  await createTorrentAndSetInfoHash(video, file)
  await file.save()

  logger.debug('Removing %s because it\'s now on object storage', oldPath)
  await remove(oldPath)
}
