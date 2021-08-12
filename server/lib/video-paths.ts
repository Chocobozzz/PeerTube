import { stat } from 'fs-extra'
import { join } from 'path'
import { buildUUID } from '@server/helpers/uuid'
import { extractVideo } from '@server/helpers/video'
import { CONFIG } from '@server/initializers/config'
import { HLS_REDUNDANCY_DIRECTORY, HLS_STREAMING_PLAYLIST_DIRECTORY, STATIC_PATHS, WEBSERVER } from '@server/initializers/constants'
import { isStreamingPlaylist, MStreamingPlaylist, MStreamingPlaylistVideo, MVideo, MVideoFile, MVideoUUID } from '@server/types/models'
import { removeFragmentedMP4Ext } from '@shared/core-utils'
import { makeAvailable } from './object-storage/shared/object-storage-helpers'

// ################## Video file name ##################

function generateWebTorrentVideoFilename (resolution: number, extname: string) {
  return buildUUID() + '-' + resolution + extname
}

function generateHLSVideoFilename (resolution: number) {
  return `${buildUUID()}-${resolution}-fragmented.mp4`
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

async function getVideoFilePathMakeAvailable (
  videoOrPlaylist: MVideo | MStreamingPlaylistVideo,
  videoFile: MVideoFile
) {
  const path = getVideoFilePath(videoOrPlaylist, videoFile)
  try {
    await stat(path)
    return path
  } catch {
    // Continue if path not available
  }

  if (videoFile.isHLS()) {
    const video = extractVideo(videoOrPlaylist)
    await makeAvailable(
      { filename: join((videoOrPlaylist as MStreamingPlaylistVideo).getStringType(), video.uuid, videoFile.filename), at: path },
      CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS
    )
    return path
  }

  await makeAvailable({ filename: videoFile.filename, at: path }, CONFIG.OBJECT_STORAGE.VIDEOS)
  return path
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
  getVideoFilePathMakeAvailable,

  generateTorrentFileName,
  getTorrentFilePath,

  getHLSDirectory,
  generateHLSMasterPlaylistFilename,
  generateHlsSha256SegmentsFilename,
  getHlsResolutionPlaylistFilename,

  getLocalVideoFileMetadataUrl,

  generateWebTorrentRedundancyUrl,
  generateHLSRedundancyUrl
}
