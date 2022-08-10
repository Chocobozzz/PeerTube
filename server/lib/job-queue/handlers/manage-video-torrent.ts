import { Job } from 'bullmq'
import { createTorrentAndSetInfoHash, updateTorrentMetadata } from '@server/helpers/webtorrent'
import { VideoModel } from '@server/models/video/video'
import { VideoFileModel } from '@server/models/video/video-file'
import { VideoStreamingPlaylistModel } from '@server/models/video/video-streaming-playlist'
import { ManageVideoTorrentPayload } from '@shared/models'
import { logger } from '../../../helpers/logger'

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

  await createTorrentAndSetInfoHash(video, file)

  // Refresh videoFile because the createTorrentAndSetInfoHash could be long
  const refreshedFile = await VideoFileModel.loadWithVideo(file.id)
  // File does not exist anymore, remove the generated torrent
  if (!refreshedFile) return file.removeTorrent()

  refreshedFile.infoHash = file.infoHash
  refreshedFile.torrentFilename = file.torrentFilename

  return refreshedFile.save()
}

async function doUpdateMetadataAction (payload: ManageVideoTorrentPayload & { action: 'update-metadata' }) {
  const [ video, streamingPlaylist, file ] = await Promise.all([
    loadVideoOrLog(payload.videoId),
    loadStreamingPlaylistOrLog(payload.streamingPlaylistId),
    loadFileOrLog(payload.videoFileId)
  ])

  if ((!video && !streamingPlaylist) || !file) return

  await updateTorrentMetadata(video || streamingPlaylist, file)

  await file.save()
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

  const file = await VideoFileModel.loadWithVideo(videoFileId)

  if (!file) {
    logger.debug('Do not process torrent for file %d: does not exist anymore.', videoFileId)
  }

  return file
}
