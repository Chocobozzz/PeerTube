import { makeDeleteRequest, makeGetRequest, makePostBodyRequest, makePutBodyRequest, makeUploadRequest } from '../requests/requests'
import { VideoPlaylistCreate } from '../../models/videos/playlist/video-playlist-create.model'
import { omit } from 'lodash'
import { VideoPlaylistUpdate } from '../../models/videos/playlist/video-playlist-update.model'
import { VideoPlaylistElementCreate } from '../../models/videos/playlist/video-playlist-element-create.model'
import { VideoPlaylistElementUpdate } from '../../models/videos/playlist/video-playlist-element-update.model'

function getVideoPlaylistsList (url: string, start: number, count: number, sort?: string) {
  const path = '/api/v1/video-playlists'

  const query = {
    start,
    count,
    sort
  }

  return makeGetRequest({
    url,
    path,
    query
  })
}

function getVideoPlaylist (url: string, playlistId: number | string, statusCodeExpected = 200) {
  const path = '/api/v1/video-playlists/' + playlistId

  return makeGetRequest({
    url,
    path,
    statusCodeExpected
  })
}

function deleteVideoPlaylist (url: string, token: string, playlistId: number | string, statusCodeExpected = 204) {
  const path = '/api/v1/video-playlists/' + playlistId

  return makeDeleteRequest({
    url,
    path,
    token,
    statusCodeExpected
  })
}

function createVideoPlaylist (options: {
  url: string,
  token: string,
  playlistAttrs: VideoPlaylistCreate,
  expectedStatus?: number
}) {
  const path = '/api/v1/video-playlists/'

  const fields = omit(options.playlistAttrs, 'thumbnailfile')

  const attaches = options.playlistAttrs.thumbnailfile
    ? { thumbnailfile: options.playlistAttrs.thumbnailfile }
    : {}

  return makeUploadRequest({
    method: 'POST',
    url: options.url,
    path,
    token: options.token,
    fields,
    attaches,
    statusCodeExpected: options.expectedStatus || 200
  })
}

function updateVideoPlaylist (options: {
  url: string,
  token: string,
  playlistAttrs: VideoPlaylistUpdate,
  playlistId: number | string,
  expectedStatus?: number
}) {
  const path = '/api/v1/video-playlists/' + options.playlistId

  const fields = omit(options.playlistAttrs, 'thumbnailfile')

  const attaches = options.playlistAttrs.thumbnailfile
    ? { thumbnailfile: options.playlistAttrs.thumbnailfile }
    : {}

  return makeUploadRequest({
    method: 'PUT',
    url: options.url,
    path,
    token: options.token,
    fields,
    attaches,
    statusCodeExpected: options.expectedStatus || 204
  })
}

function addVideoInPlaylist (options: {
  url: string,
  token: string,
  playlistId: number | string,
  elementAttrs: VideoPlaylistElementCreate
  expectedStatus?: number
}) {
  const path = '/api/v1/video-playlists/' + options.playlistId + '/videos'

  return makePostBodyRequest({
    url: options.url,
    path,
    token: options.token,
    fields: options.elementAttrs,
    statusCodeExpected: options.expectedStatus || 200
  })
}

function updateVideoPlaylistElement (options: {
  url: string,
  token: string,
  playlistId: number | string,
  videoId: number | string,
  elementAttrs: VideoPlaylistElementUpdate,
  expectedStatus?: number
}) {
  const path = '/api/v1/video-playlists/' + options.playlistId + '/videos/' + options.videoId

  return makePutBodyRequest({
    url: options.url,
    path,
    token: options.token,
    fields: options.elementAttrs,
    statusCodeExpected: options.expectedStatus || 204
  })
}

function removeVideoFromPlaylist (options: {
  url: string,
  token: string,
  playlistId: number | string,
  videoId: number | string,
  expectedStatus: number
}) {
  const path = '/api/v1/video-playlists/' + options.playlistId + '/videos/' + options.videoId

  return makeDeleteRequest({
    url: options.url,
    path,
    token: options.token,
    statusCodeExpected: options.expectedStatus || 204
  })
}

function reorderVideosPlaylist (options: {
  url: string,
  token: string,
  playlistId: number | string,
  elementAttrs: {
    startPosition: number,
    insertAfterPosition: number,
    reorderLength?: number
  },
  expectedStatus: number
}) {
  const path = '/api/v1/video-playlists/' + options.playlistId + '/videos/reorder'

  return makePostBodyRequest({
    url: options.url,
    path,
    token: options.token,
    fields: options.elementAttrs,
    statusCodeExpected: options.expectedStatus
  })
}

// ---------------------------------------------------------------------------

export {
  getVideoPlaylistsList,
  getVideoPlaylist,

  createVideoPlaylist,
  updateVideoPlaylist,
  deleteVideoPlaylist,

  addVideoInPlaylist,
  updateVideoPlaylistElement,
  removeVideoFromPlaylist,

  reorderVideosPlaylist
}
