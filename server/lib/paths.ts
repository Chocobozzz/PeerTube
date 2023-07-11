import { join } from 'path'
import { CONFIG } from '@server/initializers/config'
import { DIRECTORIES, VIDEO_LIVE } from '@server/initializers/constants'
import { isStreamingPlaylist, MStreamingPlaylistVideo, MVideo, MVideoFile, MVideoUUID } from '@server/types/models'
import { removeFragmentedMP4Ext } from '@shared/core-utils'
import { buildUUID } from '@shared/extra-utils'
import { isVideoInPrivateDirectory } from './video-privacy'

// ################## Video file name ##################

function generateWebVideoFilename (resolution: number, extname: string) {
  return buildUUID() + '-' + resolution + extname
}

function generateHLSVideoFilename (resolution: number) {
  return `${buildUUID()}-${resolution}-fragmented.mp4`
}

// ################## Streaming playlist ##################

function getLiveDirectory (video: MVideo) {
  return getHLSDirectory(video)
}

function getLiveReplayBaseDirectory (video: MVideo) {
  return join(getLiveDirectory(video), VIDEO_LIVE.REPLAY_DIRECTORY)
}

function getHLSDirectory (video: MVideo) {
  if (isVideoInPrivateDirectory(video.privacy)) {
    return join(DIRECTORIES.HLS_STREAMING_PLAYLIST.PRIVATE, video.uuid)
  }

  return join(DIRECTORIES.HLS_STREAMING_PLAYLIST.PUBLIC, video.uuid)
}

function getHLSRedundancyDirectory (video: MVideoUUID) {
  return join(DIRECTORIES.HLS_REDUNDANCY, video.uuid)
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
  generateWebVideoFilename,

  generateTorrentFileName,
  getFSTorrentFilePath,

  getHLSDirectory,
  getLiveDirectory,
  getLiveReplayBaseDirectory,
  getHLSRedundancyDirectory,

  generateHLSMasterPlaylistFilename,
  generateHlsSha256SegmentsFilename,
  getHlsResolutionPlaylistFilename
}
