import { Job } from 'bullmq'
import { extractVideo } from '@server/helpers/video.js'
import { createTorrentAndSetInfoHash, updateTorrentMetadata } from '@server/helpers/webtorrent.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { VideoModel } from '@server/models/video/video.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist.js'
import { ManageVideoTorrentPayload } from '@peertube/peertube-models'
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

    await createTorrentAndSetInfoHash(video, file)

    // Refresh videoFile because the createTorrentAndSetInfoHash could be long
    const refreshedFile = await VideoFileModel.loadWithVideo(file.id)
    // File does not exist anymore, remove the generated torrent
    if (!refreshedFile) return file.removeTorrent()

    refreshedFile.infoHash = file.infoHash
    refreshedFile.torrentFilename = file.torrentFilename

    await refreshedFile.save()
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
    await updateTorrentMetadata(video || streamingPlaylist, file)

    await file.save()
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
