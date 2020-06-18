import { isStreamingPlaylist, MStreamingPlaylistVideo, MVideo, MVideoFile, MVideoUUID } from '@server/types/models'
import { join } from 'path'
import { CONFIG } from '@server/initializers/config'
import { HLS_REDUNDANCY_DIRECTORY, HLS_STREAMING_PLAYLIST_DIRECTORY } from '@server/initializers/constants'
import { extractVideo } from '@server/helpers/video'

// ################## Video file name ##################

function getVideoFilename (videoOrPlaylist: MVideo | MStreamingPlaylistVideo, videoFile: MVideoFile) {
  const video = extractVideo(videoOrPlaylist)

  if (isStreamingPlaylist(videoOrPlaylist)) {
    return generateVideoStreamingPlaylistName(video.uuid, videoFile.resolution)
  }

  return generateWebTorrentVideoName(video.uuid, videoFile.resolution, videoFile.extname)
}

function generateVideoStreamingPlaylistName (uuid: string, resolution: number) {
  return `${uuid}-${resolution}-fragmented.mp4`
}

function generateWebTorrentVideoName (uuid: string, resolution: number, extname: string) {
  return uuid + '-' + resolution + extname
}

function getVideoFilePath (videoOrPlaylist: MVideo | MStreamingPlaylistVideo, videoFile: MVideoFile, isRedundancy = false) {
  if (isStreamingPlaylist(videoOrPlaylist)) {
    const video = extractVideo(videoOrPlaylist)
    return join(HLS_STREAMING_PLAYLIST_DIRECTORY, video.uuid, getVideoFilename(videoOrPlaylist, videoFile))
  }

  const baseDir = isRedundancy ? CONFIG.STORAGE.REDUNDANCY_DIR : CONFIG.STORAGE.VIDEOS_DIR
  return join(baseDir, getVideoFilename(videoOrPlaylist, videoFile))
}

// ################## Streaming playlist ##################

function getHLSDirectory (video: MVideoUUID, isRedundancy = false) {
  const baseDir = isRedundancy ? HLS_REDUNDANCY_DIRECTORY : HLS_STREAMING_PLAYLIST_DIRECTORY

  return join(baseDir, video.uuid)
}

// ################## Torrents ##################

function getTorrentFileName (videoOrPlaylist: MVideo | MStreamingPlaylistVideo, videoFile: MVideoFile) {
  const video = extractVideo(videoOrPlaylist)
  const extension = '.torrent'

  if (isStreamingPlaylist(videoOrPlaylist)) {
    return `${video.uuid}-${videoFile.resolution}-${videoOrPlaylist.getStringType()}${extension}`
  }

  return video.uuid + '-' + videoFile.resolution + extension
}

function getTorrentFilePath (videoOrPlaylist: MVideo | MStreamingPlaylistVideo, videoFile: MVideoFile) {
  return join(CONFIG.STORAGE.TORRENTS_DIR, getTorrentFileName(videoOrPlaylist, videoFile))
}

// ---------------------------------------------------------------------------

export {
  generateVideoStreamingPlaylistName,
  generateWebTorrentVideoName,
  getVideoFilename,
  getVideoFilePath,

  getTorrentFileName,
  getTorrentFilePath,

  getHLSDirectory
}
