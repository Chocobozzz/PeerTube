import * as Bull from 'bull'
import { logger } from '@server/helpers/logger'
import { MoveObjectStoragePayload } from '../../../../shared'
import { VideoModel } from '@server/models/video/video'
import { generateObjectStoreUrl, storeObject } from '@server/lib/object-storage'
import { CONFIG } from '@server/initializers/config'
import { join } from 'path'
import { HLS_STREAMING_PLAYLIST_DIRECTORY } from '@server/initializers/constants'
import { getHlsResolutionPlaylistFilename } from '@server/lib/video-paths'
import { MVideoWithAllFiles, VideoStorageType } from '@server/types/models'
import { remove } from 'fs-extra'
import { publishAndFederateIfNeeded } from '@server/lib/video'
import { VideoJobInfoModel } from '@server/models/video/video-job-info'

export async function processMoveToObjectStorage (job: Bull.Job) {
  const payload = job.data as MoveObjectStoragePayload
  logger.info('Moving video %s in job %d.', payload.videoUUID, job.id)

  const video = await VideoModel.loadWithFiles(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Can\'t process job %d, video does not exist.', job.id)
    return undefined
  }

  if (CONFIG.TRANSCODING.WEBTORRENT.ENABLED && video.VideoFiles) {
    await moveWebTorrentFiles(video, payload.videoFileId)
  }

  if (CONFIG.TRANSCODING.HLS.ENABLED && video.VideoStreamingPlaylists) {
    await moveHLSFiles(video, payload.videoFileId)
  }

  const pendingMove = await VideoJobInfoModel.decreasePendingMove(video.uuid)
  if (pendingMove === 0) {
    logger.info("Running cleanup after moving files to object storage (video %s in job %d)", video.uuid, job.id)
    await doAfterLastJob(video)
  }

  return payload.videoUUID
}

async function moveWebTorrentFiles (video: MVideoWithAllFiles, videoFileId?: number) {
  for (const file of video.VideoFiles) {
    if (file.storage !== VideoStorageType.LOCAL) continue
    if (videoFileId !== null && file.id !== videoFileId) continue

    const filename = file.filename
    await storeObject(
      { filename, path: join(CONFIG.STORAGE.VIDEOS_DIR, file.filename) },
      CONFIG.OBJECT_STORAGE.VIDEOS
    )

    file.storage = VideoStorageType.OBJECT_STORAGE
    file.fileUrl = generateObjectStoreUrl(filename, CONFIG.OBJECT_STORAGE.VIDEOS)
    await file.save()
  }
}

async function moveHLSFiles (video: MVideoWithAllFiles, videoFileId: number) {
  for (const playlist of video.VideoStreamingPlaylists) {
    const baseHlsDirectory = join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid)

    for (const file of playlist.VideoFiles) {
      if (file.storage !== VideoStorageType.LOCAL) continue
      if (videoFileId !== null && file.id !== videoFileId) continue

      // Resolution playlist
      const playlistFileName = getHlsResolutionPlaylistFilename(file.filename)
      await storeObject(
        {
          filename: join(playlist.getStringType(), video.uuid, playlistFileName),
          path: join(baseHlsDirectory, playlistFileName)
        },
        CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS
      )

      // Resolution fragmented file
      const filename = join(playlist.getStringType(), video.uuid, file.filename)
      await storeObject(
        {
          filename,
          path: join(baseHlsDirectory, file.filename)
        },
        CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS
      )

      // Signals that the video file + playlist file were uploaded
      file.storage = VideoStorageType.OBJECT_STORAGE
      file.fileUrl = generateObjectStoreUrl(filename, CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS)
      await file.save()
    }
  }
}

async function doAfterLastJob (video: MVideoWithAllFiles) {
  for (const playlist of video.VideoStreamingPlaylists) {
    const baseHlsDirectory = join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid)
    // Master playlist
    const masterPlaylistFilename = join(playlist.getStringType(), video.uuid, playlist.playlistFilename)
    await storeObject(
      {
        filename: masterPlaylistFilename,
        path: join(baseHlsDirectory, playlist.playlistFilename)
      },
      CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS
    )

    // Sha256 segments file
    const segmentsFileName = join(playlist.getStringType(), video.uuid, playlist.segmentsSha256Filename)
    await storeObject(
      {
        filename: segmentsFileName,
        path: join(baseHlsDirectory, playlist.segmentsSha256Filename)
      },
      CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS
    )

    playlist.playlistUrl = generateObjectStoreUrl(masterPlaylistFilename, CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS)
    playlist.segmentsSha256Url = generateObjectStoreUrl(segmentsFileName, CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS)
    playlist.storage = VideoStorageType.OBJECT_STORAGE
    await playlist.save()
  }

  // Remove files that were "moved"
  const tasks: Promise<any>[] = []

  for (const file of video.VideoFiles) {
    tasks.push(remove(join(CONFIG.STORAGE.VIDEOS_DIR, file.filename)))
  }

  if (video.VideoStreamingPlaylists) {
    tasks.push(remove(join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid)))
  }

  await Promise.all(tasks)
  await publishAndFederateIfNeeded(video)
}
