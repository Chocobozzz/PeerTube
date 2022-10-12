import { Job } from 'bullmq'
import { remove } from 'fs-extra'
import { join } from 'path'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { updateTorrentMetadata } from '@server/helpers/webtorrent'
import { P2P_MEDIA_LOADER_PEER_VERSION } from '@server/initializers/constants'
import { storeHLSFileFromFilename, storeWebTorrentFile } from '@server/lib/object-storage'
import { getHLSDirectory, getHlsResolutionPlaylistFilename } from '@server/lib/paths'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { moveToFailedMoveToObjectStorageState, moveToNextState } from '@server/lib/video-state'
import { VideoModel } from '@server/models/video/video'
import { VideoJobInfoModel } from '@server/models/video/video-job-info'
import { MStreamingPlaylistVideo, MVideo, MVideoFile, MVideoWithAllFiles } from '@server/types/models'
import { MoveObjectStoragePayload, VideoState, VideoStorage } from '@shared/models'

const lTagsBase = loggerTagsFactory('move-object-storage')

export async function processMoveToObjectStorage (job: Job) {
  const payload = job.data as MoveObjectStoragePayload
  logger.info('Moving video %s in job %s.', payload.videoUUID, job.id)

  const video = await VideoModel.loadWithFiles(payload.videoUUID)
  // No video, maybe deleted?
  if (!video) {
    logger.info('Can\'t process job %d, video does not exist.', job.id, lTagsBase(payload.videoUUID))
    return undefined
  }

  const lTags = lTagsBase(video.uuid, video.url)

  try {
    if (video.VideoFiles) {
      logger.debug('Moving %d webtorrent files for video %s.', video.VideoFiles.length, video.uuid, lTags)

      await moveWebTorrentFiles(video)
    }

    if (video.VideoStreamingPlaylists) {
      logger.debug('Moving HLS playlist of %s.', video.uuid)

      await moveHLSFiles(video)
    }

    const pendingMove = await VideoJobInfoModel.decrease(video.uuid, 'pendingMove')
    if (pendingMove === 0) {
      logger.info('Running cleanup after moving files to object storage (video %s in job %s)', video.uuid, job.id, lTags)

      await doAfterLastJob({ video, previousVideoState: payload.previousVideoState, isNewVideo: payload.isNewVideo })
    }
  } catch (err) {
    await onMoveToObjectStorageFailure(job, err)
  }

  return payload.videoUUID
}

export async function onMoveToObjectStorageFailure (job: Job, err: any) {
  const payload = job.data as MoveObjectStoragePayload

  const video = await VideoModel.loadWithFiles(payload.videoUUID)
  if (!video) return

  logger.error('Cannot move video %s to object storage.', video.url, { err, ...lTagsBase(video.uuid, video.url) })

  await moveToFailedMoveToObjectStorageState(video)
  await VideoJobInfoModel.abortAllTasks(video.uuid, 'pendingMove')
}

// ---------------------------------------------------------------------------

async function moveWebTorrentFiles (video: MVideoWithAllFiles) {
  for (const file of video.VideoFiles) {
    if (file.storage !== VideoStorage.FILE_SYSTEM) continue

    const fileUrl = await storeWebTorrentFile(video, file)

    const oldPath = VideoPathManager.Instance.getFSVideoFileOutputPath(video, file)
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
      await storeHLSFileFromFilename(playlistWithVideo, playlistFilename)

      // Resolution fragmented file
      const fileUrl = await storeHLSFileFromFilename(playlistWithVideo, file.filename)

      const oldPath = join(getHLSDirectory(video), file.filename)

      await onFileMoved({ videoOrPlaylist: Object.assign(playlist, { Video: video }), file, fileUrl, oldPath })
    }
  }
}

async function doAfterLastJob (options: {
  video: MVideoWithAllFiles
  previousVideoState: VideoState
  isNewVideo: boolean
}) {
  const { video, previousVideoState, isNewVideo } = options

  for (const playlist of video.VideoStreamingPlaylists) {
    if (playlist.storage === VideoStorage.OBJECT_STORAGE) continue

    const playlistWithVideo = playlist.withVideo(video)

    // Master playlist
    playlist.playlistUrl = await storeHLSFileFromFilename(playlistWithVideo, playlist.playlistFilename)
    // Sha256 segments file
    playlist.segmentsSha256Url = await storeHLSFileFromFilename(playlistWithVideo, playlist.segmentsSha256Filename)

    playlist.storage = VideoStorage.OBJECT_STORAGE

    playlist.assignP2PMediaLoaderInfoHashes(video, playlist.VideoFiles)
    playlist.p2pMediaLoaderPeerVersion = P2P_MEDIA_LOADER_PEER_VERSION

    await playlist.save()
  }

  // Remove empty hls video directory
  if (video.VideoStreamingPlaylists) {
    await remove(getHLSDirectory(video))
  }

  await moveToNextState({ video, previousVideoState, isNewVideo })
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
