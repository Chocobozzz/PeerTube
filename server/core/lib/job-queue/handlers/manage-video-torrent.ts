import { ManageVideoTorrentPayload } from '@peertube/peertube-models'
import { retryTransactionWrapper } from '@server/helpers/database-utils.js'
import { extractVideo } from '@server/helpers/video.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { createTorrentForFile, updateTorrentForFileAndSave } from '@server/lib/webtorrent.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoInfohashModel } from '@server/models/video/video-infohash.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import { VideoModel } from '@server/models/video/video.js'
import { Job } from 'bullmq'
import { logger } from '../../../helpers/logger.js'

async function processManageVideoTorrent (job: Job) {
  const payload = job.data as ManageVideoTorrentPayload
  logger.info('Processing torrent in job %s.', job.id)

  if (payload.action === 'create') return doCreateAction(payload)
  if (payload.action === 'update-metadata') return doUpdateMetadataAction(payload)
}

// ---------------------------------------------------------------------------

export {
  processManageVideoTorrent
}

// ---------------------------------------------------------------------------

async function doCreateAction (payload: ManageVideoTorrentPayload & { action: 'create' }) {
  const [ video, file ] = await Promise.all([
    loadVideoOrLog(payload.videoId),
    loadFileOrLog(payload.videoFileId)
  ])

  if (!video || !file) return

  const fileMutexReleaser = await VideoPathManager.Instance.lockFiles(video.uuid)

  try {
    await video.reload()
    await file.reload()

    const { infoHash, torrentFilename } = await createTorrentForFile(video, file)

    const saved = await retryTransactionWrapper(() => {
      return sequelizeTypescript.transaction(async transaction => {
        // Refresh videoFile because the createTorrentAndSetInfoHash could be long
        // Also reload on every attempt: after a rollback the previous instance has no changed attribute left to save
        const refreshedFile = await VideoFileModel.loadWithVideo(file.id, transaction)
        if (!refreshedFile) return false

        refreshedFile.torrentFilename = torrentFilename
        await refreshedFile.save({ transaction })

        await VideoInfohashModel.replaceFileInfohash(refreshedFile.id, infoHash, transaction)

        return true
      })
    })

    // File does not exist anymore, remove the generated torrent
    if (!saved) await file.removeTorrent()
  } finally {
    fileMutexReleaser()
  }
}

async function doUpdateMetadataAction (payload: ManageVideoTorrentPayload & { action: 'update-metadata' }) {
  const [ video, streamingPlaylist, file ] = await Promise.all([
    loadVideoOrLog(payload.videoId),
    loadStreamingPlaylistOrLog(payload.streamingPlaylistId),
    loadFileOrLog(payload.videoFileId)
  ])

  if ((!video && !streamingPlaylist) || !file) return

  const extractedVideo = extractVideo(video || streamingPlaylist)
  const fileMutexReleaser = await VideoPathManager.Instance.lockFiles(extractedVideo.uuid)

  try {
    await updateTorrentForFileAndSave(video || streamingPlaylist, file)
  } finally {
    fileMutexReleaser()
  }
}

async function loadVideoOrLog (videoId: number) {
  if (!videoId) return undefined

  const video = await VideoModel.load(videoId)
  if (!video) {
    logger.debug('Do not process torrent for video %d: does not exist anymore.', videoId)
  }

  return video
}

async function loadStreamingPlaylistOrLog (streamingPlaylistId: number) {
  if (!streamingPlaylistId) return undefined

  const streamingPlaylist = await VideoStreamingPlaylistModel.loadWithVideo(streamingPlaylistId)
  if (!streamingPlaylist) {
    logger.debug('Do not process torrent for streaming playlist %d: does not exist anymore.', streamingPlaylistId)
  }

  return streamingPlaylist
}

async function loadFileOrLog (videoFileId: number) {
  if (!videoFileId) return undefined

  const file = await VideoFileModel.load(videoFileId)

  if (!file) {
    logger.debug('Do not process torrent for file %d: does not exist anymore.', videoFileId)
  }

  return file
}
