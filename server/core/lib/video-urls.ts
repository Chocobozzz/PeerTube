import { STATIC_PATHS, WEBSERVER } from '@server/initializers/constants.js'
import { MStreamingPlaylist, MVideo, MVideoFile, MVideoUUID } from '@server/types/models/index.js'

// ################## Redundancy ##################

function generateHLSRedundancyUrl (video: MVideo, playlist: MStreamingPlaylist) {
  // Base URL used by our HLS player
  return WEBSERVER.URL + STATIC_PATHS.REDUNDANCY + playlist.getStringType() + '/' + video.uuid
}

function generateWebVideoRedundancyUrl (file: MVideoFile) {
  return WEBSERVER.URL + STATIC_PATHS.REDUNDANCY + file.filename
}

// ################## Meta data ##################

function getLocalVideoFileMetadataUrl (video: MVideoUUID, videoFile: MVideoFile) {
  const path = '/api/v1/videos/'

  return WEBSERVER.URL + path + video.uuid + '/metadata/' + videoFile.id
}

// ---------------------------------------------------------------------------

export {
  getLocalVideoFileMetadataUrl,

  generateWebVideoRedundancyUrl,
  generateHLSRedundancyUrl
}
