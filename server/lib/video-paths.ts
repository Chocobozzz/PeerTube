import { join } from 'path'
import { extractVideo } from '@server/helpers/video'
import { CONFIG } from '@server/initializers/config'
import { HLS_REDUNDANCY_DIRECTORY, HLS_STREAMING_PLAYLIST_DIRECTORY, STATIC_PATHS, WEBSERVER } from '@server/initializers/constants'
import { isStreamingPlaylist, MStreamingPlaylist, MStreamingPlaylistVideo, MVideo, MVideoFile, MVideoUUID } from '@server/types/models'
import { buildUUID } from '@server/helpers/uuid'

// ################## Video file name ##################

function generateWebTorrentVideoFilename (resolution: number, extname: string) {
  const uuid = buildUUID()

  return uuid + '-' + resolution + extname
}

function generateHLSVideoFilename (resolution: number) {
  const uuid = buildUUID()

  return `${uuid}-${resolution}-fragmented.mp4`
}

function getVideoFilePath (videoOrPlaylist: MVideo | MStreamingPlaylistVideo, videoFile: MVideoFile, isRedundancy = false) {
  if (videoFile.isHLS()) {
    const video = extractVideo(videoOrPlaylist)

    return join(getHLSDirectory(video), videoFile.filename)
  }

  const baseDir = isRedundancy
    ? CONFIG.STORAGE.REDUNDANCY_DIR
    : CONFIG.STORAGE.VIDEOS_DIR

  return join(baseDir, videoFile.filename)
}

// ################## Redundancy ##################

function generateHLSRedundancyUrl (video: MVideo, playlist: MStreamingPlaylist) {
  // Base URL used by our HLS player
  return WEBSERVER.URL + STATIC_PATHS.REDUNDANCY + playlist.getStringType() + '/' + video.uuid
}

function generateWebTorrentRedundancyUrl (file: MVideoFile) {
  return WEBSERVER.URL + STATIC_PATHS.REDUNDANCY + file.filename
}

// ################## Streaming playlist ##################

function getHLSDirectory (video: MVideoUUID, isRedundancy = false) {
  const baseDir = isRedundancy
    ? HLS_REDUNDANCY_DIRECTORY
    : HLS_STREAMING_PLAYLIST_DIRECTORY

  return join(baseDir, video.uuid)
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

function getTorrentFilePath (videoFile: MVideoFile) {
  return join(CONFIG.STORAGE.TORRENTS_DIR, videoFile.torrentFilename)
}

// ################## Meta data ##################

function getLocalVideoFileMetadataUrl (video: MVideoUUID, videoFile: MVideoFile) {
  const path = '/api/v1/videos/'

  return WEBSERVER.URL + path + video.uuid + '/metadata/' + videoFile.id
}

// ---------------------------------------------------------------------------

export {
  generateHLSVideoFilename,
  generateWebTorrentVideoFilename,

  getVideoFilePath,

  generateTorrentFileName,
  getTorrentFilePath,

  getHLSDirectory,

  getLocalVideoFileMetadataUrl,

  generateWebTorrentRedundancyUrl,
  generateHLSRedundancyUrl
}
