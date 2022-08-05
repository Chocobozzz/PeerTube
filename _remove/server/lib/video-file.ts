import { logger } from '@server/helpers/logger'
import { MVideoWithAllFiles } from '@server/types/models'
import { lTags } from './object-storage/shared'

async function removeHLSPlaylist (video: MVideoWithAllFiles) {
  const hls = video.getHLSPlaylist()
  if (!hls) return

  await video.removeStreamingPlaylistFiles(hls)
  await hls.destroy()

  video.VideoStreamingPlaylists = video.VideoStreamingPlaylists.filter(p => p.id !== hls.id)
}

async function removeHLSFile (video: MVideoWithAllFiles, fileToDeleteId: number) {
  logger.info('Deleting HLS file %d of %s.', fileToDeleteId, video.url, lTags(video.uuid))

  const hls = video.getHLSPlaylist()
  const files = hls.VideoFiles

  if (files.length === 1) {
    await removeHLSPlaylist(video)
    return undefined
  }

  const toDelete = files.find(f => f.id === fileToDeleteId)
  await video.removeStreamingPlaylistVideoFile(video.getHLSPlaylist(), toDelete)
  await toDelete.destroy()

  hls.VideoFiles = hls.VideoFiles.filter(f => f.id !== toDelete.id)

  return hls
}

// ---------------------------------------------------------------------------

async function removeAllWebTorrentFiles (video: MVideoWithAllFiles) {
  for (const file of video.VideoFiles) {
    await video.removeWebTorrentFile(file)
    await file.destroy()
  }

  video.VideoFiles = []

  return video
}

async function removeWebTorrentFile (video: MVideoWithAllFiles, fileToDeleteId: number) {
  const files = video.VideoFiles

  if (files.length === 1) {
    return removeAllWebTorrentFiles(video)
  }

  const toDelete = files.find(f => f.id === fileToDeleteId)
  await video.removeWebTorrentFile(toDelete)
  await toDelete.destroy()

  video.VideoFiles = files.filter(f => f.id !== toDelete.id)

  return video
}

export {
  removeHLSPlaylist,
  removeHLSFile,
  removeAllWebTorrentFiles,
  removeWebTorrentFile
}
