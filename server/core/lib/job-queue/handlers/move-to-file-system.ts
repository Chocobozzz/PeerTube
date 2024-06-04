import { FileStorage, MoveStoragePayload, VideoStateType } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { updateTorrentMetadata } from '@server/helpers/webtorrent.js'
import { P2P_MEDIA_LOADER_PEER_VERSION } from '@server/initializers/constants.js'
import {
  makeHLSFileAvailable,
  makeOriginalFileAvailable,
  makeWebVideoFileAvailable,
  removeHLSFileObjectStorageByFilename,
  removeHLSObjectStorage,
  removeOriginalFileObjectStorage,
  removeWebVideoObjectStorage
} from '@server/lib/object-storage/index.js'
import { getHLSDirectory, getHlsResolutionPlaylistFilename } from '@server/lib/paths.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { moveToFailedMoveToFileSystemState, moveToNextState } from '@server/lib/video-state.js'
import { MStreamingPlaylistVideo, MVideo, MVideoFile, MVideoWithAllFiles } from '@server/types/models/index.js'
import { MVideoSource } from '@server/types/models/video/video-source.js'
import { Job } from 'bullmq'
import { join } from 'path'
import { moveToJob, onMoveToStorageFailure } from './shared/move-video.js'

const lTagsBase = loggerTagsFactory('move-file-system')

export async function processMoveToFileSystem (job: Job) {
  const payload = job.data as MoveStoragePayload
  logger.info('Moving video %s to file system in job %s.', payload.videoUUID, job.id)

  await moveToJob({
    jobId: job.id,
    videoUUID: payload.videoUUID,
    loggerTags: lTagsBase().tags,

    moveWebVideoFiles,
    moveHLSFiles,
    moveVideoSourceFile,

    doAfterLastMove: video => doAfterLastMove({ video, previousVideoState: payload.previousVideoState, isNewVideo: payload.isNewVideo }),
    moveToFailedState: moveToFailedMoveToFileSystemState
  })
}

export async function onMoveToFileSystemFailure (job: Job, err: any) {
  const payload = job.data as MoveStoragePayload

  await onMoveToStorageFailure({
    videoUUID: payload.videoUUID,
    err,
    lTags: lTagsBase(),
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

    for (const file of playlist.VideoFiles) {
      if (file.storage === FileStorage.FILE_SYSTEM) continue

      // Resolution playlist
      const playlistFilename = getHlsResolutionPlaylistFilename(file.filename)
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

async function doAfterLastMove (options: {
  video: MVideoWithAllFiles
  previousVideoState: VideoStateType
  isNewVideo: boolean
}) {
  const { video, previousVideoState, isNewVideo } = options

  for (const playlist of video.VideoStreamingPlaylists) {
    if (playlist.storage === FileStorage.FILE_SYSTEM) continue

    const playlistWithVideo = playlist.withVideo(video)

    for (const filename of [ playlist.playlistFilename, playlist.segmentsSha256Filename ]) {
      await makeHLSFileAvailable(playlistWithVideo, filename, join(getHLSDirectory(video), filename))
    }

    playlist.playlistUrl = null
    playlist.segmentsSha256Url = null
    playlist.storage = FileStorage.FILE_SYSTEM

    playlist.assignP2PMediaLoaderInfoHashes(video, playlist.VideoFiles)
    playlist.p2pMediaLoaderPeerVersion = P2P_MEDIA_LOADER_PEER_VERSION

    await playlist.save()

    await removeHLSObjectStorage(playlistWithVideo)
  }

  await moveToNextState({ video, previousVideoState, isNewVideo })
}
