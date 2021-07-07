import { join } from 'path'
import { extractVideo } from '@server/helpers/video'
import { CONFIG } from '@server/initializers/config'
import { HLS_REDUNDANCY_DIRECTORY, HLS_STREAMING_PLAYLIST_DIRECTORY, STATIC_PATHS, WEBSERVER } from '@server/initializers/constants'
import { isStreamingPlaylist, MStreamingPlaylist, MStreamingPlaylistVideo, MVideo, MVideoFile, MVideoUUID } from '@server/types/models'

// ################## Video file name ##################

function generateVideoFilename (videoOrPlaylist: MVideo | MStreamingPlaylistVideo, isHls: boolean, resolution: number, extname: string) {
  const video = extractVideo(videoOrPlaylist)

  // FIXME: use a generated uuid instead, that will break compatibility with PeerTube < 3.1
  // const uuid = uuidv4()
  const uuid = video.uuid

  if (isHls) {
    return generateVideoStreamingPlaylistName(uuid, resolution)
  }

  return generateWebTorrentVideoName(uuid, resolution, extname)
}

function generateVideoStreamingPlaylistName (uuid: string, resolution: number) {
  return `${uuid}-${resolution}-fragmented.mp4`
}

function generateWebTorrentVideoName (uuid: string, resolution: number, extname: string) {
  return uuid + '-' + resolution + extname
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
  const video = extractVideo(videoOrPlaylist)
  const extension = '.torrent'

  // FIXME: use a generated uuid instead, that will break compatibility with PeerTube < 3.1
  // const uuid = uuidv4()
  const uuid = video.uuid

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
  generateVideoStreamingPlaylistName,
  generateWebTorrentVideoName,
  generateVideoFilename,
  getVideoFilePath,

  generateTorrentFileName,
  getTorrentFilePath,

  getHLSDirectory,

  getLocalVideoFileMetadataUrl,

  generateWebTorrentRedundancyUrl,
  generateHLSRedundancyUrl
}
