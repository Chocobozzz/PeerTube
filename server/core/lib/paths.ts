import { join } from 'path'
import { CONFIG } from '@server/initializers/config.js'
import { DIRECTORIES, VIDEO_LIVE } from '@server/initializers/constants.js'
import {
  isStreamingPlaylist,
  MStreamingPlaylistVideo,
  MUserExport,
  MUserImport,
  MVideo,
  MVideoFile,
  MVideoUUID
} from '@server/types/models/index.js'
import { removeFragmentedMP4Ext } from '@peertube/peertube-core-utils'
import { buildUUID } from '@peertube/peertube-node-utils'
import { isVideoInPrivateDirectory } from './video-privacy.js'

// ################## Video file name ##################

export function generateWebVideoFilename (resolution: number, extname: string) {
  return buildUUID() + '-' + resolution + extname
}

export function generateHLSVideoFilename (resolution: number) {
  return `${buildUUID()}-${resolution}-fragmented.mp4`
}

// ################## Streaming playlist ##################

export function getLiveDirectory (video: MVideo) {
  return getHLSDirectory(video)
}

export function getLiveReplayBaseDirectory (video: MVideo) {
  return join(getLiveDirectory(video), VIDEO_LIVE.REPLAY_DIRECTORY)
}

export function getHLSDirectory (video: MVideo) {
  if (isVideoInPrivateDirectory(video.privacy)) {
    return join(DIRECTORIES.HLS_STREAMING_PLAYLIST.PRIVATE, video.uuid)
  }

  return join(DIRECTORIES.HLS_STREAMING_PLAYLIST.PUBLIC, video.uuid)
}

export function getHLSRedundancyDirectory (video: MVideoUUID) {
  return join(DIRECTORIES.HLS_REDUNDANCY, video.uuid)
}

export function getHlsResolutionPlaylistFilename (videoFilename: string) {
  // Video file name already contain resolution
  return removeFragmentedMP4Ext(videoFilename) + '.m3u8'
}

export function generateHLSMasterPlaylistFilename (isLive = false) {
  if (isLive) return 'master.m3u8'

  return buildUUID() + '-master.m3u8'
}

export function generateHlsSha256SegmentsFilename (isLive = false) {
  if (isLive) return 'segments-sha256.json'

  return buildUUID() + '-segments-sha256.json'
}

// ################## Torrents ##################

export function generateTorrentFileName (videoOrPlaylist: MVideo | MStreamingPlaylistVideo, resolution: number) {
  const extension = '.torrent'
  const uuid = buildUUID()

  if (isStreamingPlaylist(videoOrPlaylist)) {
    return `${uuid}-${resolution}-${videoOrPlaylist.getStringType()}${extension}`
  }

  return uuid + '-' + resolution + extension
}

export function getFSTorrentFilePath (videoFile: MVideoFile) {
  return join(CONFIG.STORAGE.TORRENTS_DIR, videoFile.torrentFilename)
}

// ---------------------------------------------------------------------------

export function getFSUserExportFilePath (userExport: MUserExport) {
  return join(CONFIG.STORAGE.TMP_PERSISTENT_DIR, userExport.filename)
}

export function getFSUserImportFilePath (userImport: MUserImport) {
  return join(CONFIG.STORAGE.TMP_PERSISTENT_DIR, userImport.filename)
}
