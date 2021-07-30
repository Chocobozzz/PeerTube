import * as Bull from 'bull'
import { logger } from '@server/helpers/logger'
import {
  MoveObjectStoragePayload, VideoState
} from '../../../../shared'
import { VideoModel } from '@server/models/video/video'
import { storeObject } from '@server/lib/object-storage'
import { CONFIG } from '@server/initializers/config'
import { join } from 'path'
import { HLS_STREAMING_PLAYLIST_DIRECTORY } from '@server/initializers/constants'
import { getHlsResolutionPlaylistFilename } from '@server/lib/video-paths'
import { MVideoWithAllFiles, VideoStorageType } from '@server/types/models'

export async function processMoveToObjectStorage (job: Bull.Job) {
  const payload = job.data as MoveObjectStoragePayload
  logger.info('Moving video %s in job %d.', payload.videoUUID, job.id)

  const video = await VideoModel.loadWithFiles(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Can\'t process job %d, video does not exist.', job.id)
    return undefined
  }

  if (video.state === VideoState.TO_TRANSCODE) {
    logger.info('Video needs to be transcoded still, exiting move job %d', job.id)
    return undefined
  }

  if (video.transcodeJobsRunning > 0) {
    logger.info('A transcode job for this video is running, exiting move job %d', job.id)
    return undefined
  }

  if (video.VideoFiles) {
    await moveWebTorrentFiles(video)
  }

  if (video.VideoStreamingPlaylists) {
    await moveHLSFiles(video)
  }

  return payload.videoUUID
}

async function moveWebTorrentFiles (video: MVideoWithAllFiles) {
  for (const file of video.VideoFiles) {
    if (file.storage !== VideoStorageType.LOCAL) continue

    const filename = file.filename
    await storeObject(
      { filename, path: join(CONFIG.STORAGE.VIDEOS_DIR, file.filename) },
      CONFIG.S3.VIDEOS_BUCKETINFO
    )

    file.storage = VideoStorageType.OBJECT_STORAGE
    file.fileUrl = `https://${CONFIG.S3.VIDEOS_BUCKETINFO.bucket}.${CONFIG.S3.ENDPOINT}/${CONFIG.S3.VIDEOS_BUCKETINFO.prefix}${filename}`
    await file.save()
  }
}

async function moveHLSFiles (video: MVideoWithAllFiles) {
  for (const playlist of video.VideoStreamingPlaylists) {
    const baseHlsDirectory = join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid)

    // Master playlist
    const masterPlaylistFilename = join(playlist.getStringType(), video.uuid, playlist.playlistFilename)
    await storeObject(
      {
        filename: masterPlaylistFilename,
        path: join(baseHlsDirectory, playlist.playlistFilename)
      },
      CONFIG.S3.STREAMING_PLAYLISTS_BUCKETINFO
    )

    // Sha256 segments file
    const segmentsFileName = join(playlist.getStringType(), video.uuid, playlist.segmentsSha256Filename)
    await storeObject(
      {
        filename: segmentsFileName,
        path: join(baseHlsDirectory, playlist.segmentsSha256Filename)
      },
      CONFIG.S3.STREAMING_PLAYLISTS_BUCKETINFO
    )

    // eslint-disable-next-line max-len
    playlist.playlistUrl = `https://${CONFIG.S3.STREAMING_PLAYLISTS_BUCKETINFO.bucket}.${CONFIG.S3.ENDPOINT}/${CONFIG.S3.STREAMING_PLAYLISTS_BUCKETINFO.prefix}${masterPlaylistFilename}`
    // eslint-disable-next-line max-len
    playlist.segmentsSha256Url = `https://${CONFIG.S3.STREAMING_PLAYLISTS_BUCKETINFO.bucket}.${CONFIG.S3.ENDPOINT}/${CONFIG.S3.STREAMING_PLAYLISTS_BUCKETINFO.prefix}${segmentsFileName}`

    for (const videoFile of playlist.VideoFiles) {
      const file = await videoFile.reload()
      if (file.storage !== VideoStorageType.LOCAL) continue

      // Resolution playlist
      const playlistFileName = getHlsResolutionPlaylistFilename(file.filename)
      await storeObject(
        {
          filename: join(playlist.getStringType(), video.uuid, playlistFileName),
          path: join(baseHlsDirectory, playlistFileName)
        },
        CONFIG.S3.STREAMING_PLAYLISTS_BUCKETINFO
      )

      // Resolution fragmented file
      const filename = join(playlist.getStringType(), video.uuid, file.filename)
      await storeObject(
        {
          filename,
          path: join(baseHlsDirectory, file.filename)
        },
        CONFIG.S3.STREAMING_PLAYLISTS_BUCKETINFO
      )

      // Signals that the video file + playlist file were uploaded
      file.storage = VideoStorageType.OBJECT_STORAGE
      // eslint-disable-next-line max-len
      file.fileUrl = `https://${CONFIG.S3.STREAMING_PLAYLISTS_BUCKETINFO.bucket}.${CONFIG.S3.ENDPOINT}/${CONFIG.S3.STREAMING_PLAYLISTS_BUCKETINFO.prefix}${filename}`
      await file.save()
    }

    playlist.storage = VideoStorageType.OBJECT_STORAGE
    await playlist.save()
  }
}
