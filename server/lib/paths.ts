import { join } from 'path'
import { CONFIG } from '@server/initializers/config'
import { HLS_REDUNDANCY_DIRECTORY, HLS_STREAMING_PLAYLIST_DIRECTORY } from '@server/initializers/constants'
import { isStreamingPlaylist, MStreamingPlaylistVideo, MVideo, MVideoFile, MVideoUUID } from '@server/types/models'
import { buildUUID, removeFragmentedMP4Ext } from '@shared/core-utils'

// ################## Video file name ##################

function generateWebTorrentVideoFilename (resolution: number, extname: string) {
  return buildUUID() + '-' + resolution + extname
}

function generateHLSVideoFilename (resolution: number) {
  return `${buildUUID()}-${resolution}-fragmented.mp4`
}

// ################## Streaming playlist ##################

function getLiveDirectory (video: MVideoUUID) {
  return getHLSDirectory(video)
}

function getHLSDirectory (video: MVideoUUID) {
  return join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid)
}

function getHLSRedundancyDirectory (video: MVideoUUID) {
  return join(HLS_REDUNDANCY_DIRECTORY, video.uuid)
}

function getHlsResolutionPlaylistFilename (videoFilename: string) {
  // Video file name already contain resolution
  return removeFragmentedMP4Ext(videoFilename) + '.m3u8'
}

function generateHLSMasterPlaylistFilename (isLive = false) {
  if (isLive) return 'master.m3u8'

  return buildUUID() + '-master.m3u8'
}

function generateHlsSha256SegmentsFilename (isLive = false) {
  if (isLive) return 'segments-sha256.json'

  return buildUUID() + '-segments-sha256.json'
}

// ################## Torrents ##################

function generateTorrentFileName (videoOrPlaylist: MVideo | MStreamingPlaylistVideo, resolution: number) {
  const extension = '.torrent'
  const uuid = buildUUID()

  if (isStreamingPlaylist(videoOrPlaylist)) {
    return `${uuid}-${resolution}-${videoOrPlaylist.getStringType()}${extension}`
  }

  return uuid + '-' + resolution + extension
}

function getFSTorrentFilePath (videoFile: MVideoFile) {
  return join(CONFIG.STORAGE.TORRENTS_DIR, videoFile.torrentFilename)
}

// ---------------------------------------------------------------------------

export {
  generateHLSVideoFilename,
  generateWebTorrentVideoFilename,

  generateTorrentFileName,
  getFSTorrentFilePath,

  getHLSDirectory,
  getLiveDirectory,
  getHLSRedundancyDirectory,

  generateHLSMasterPlaylistFilename,
  generateHlsSha256SegmentsFilename,
  getHlsResolutionPlaylistFilename
}
