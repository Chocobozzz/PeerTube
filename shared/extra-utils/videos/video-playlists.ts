import { makeDeleteRequest, makeGetRequest, makePostBodyRequest, makePutBodyRequest, makeUploadRequest } from '../requests/requests'
import { VideoPlaylistCreate } from '../../models/videos/playlist/video-playlist-create.model'
import { omit } from 'lodash'
import { VideoPlaylistUpdate } from '../../models/videos/playlist/video-playlist-update.model'
import { VideoPlaylistElementCreate } from '../../models/videos/playlist/video-playlist-element-create.model'
import { VideoPlaylistElementUpdate } from '../../models/videos/playlist/video-playlist-element-update.model'
import { videoUUIDToId } from './videos'
import { join } from 'path'
import { root } from '..'
import { readdir } from 'fs-extra'
import { expect } from 'chai'
import { VideoPlaylistType } from '../../models/videos/playlist/video-playlist-type.model'

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
    query,
    statusCodeExpected: 200
  })
}

function getVideoChannelPlaylistsList (url: string, videoChannelName: string, start: number, count: number, sort?: string) {
  const path = '/api/v1/video-channels/' + videoChannelName + '/video-playlists'

  const query = {
    start,
    count,
    sort
  }

  return makeGetRequest({
    url,
    path,
    query,
    statusCodeExpected: 200
  })
}

function getAccountPlaylistsList (url: string, accountName: string, start: number, count: number, sort?: string, search?: string) {
  const path = '/api/v1/accounts/' + accountName + '/video-playlists'

  const query = {
    start,
    count,
    sort,
    search
  }

  return makeGetRequest({
    url,
    path,
    query,
    statusCodeExpected: 200
  })
}

function getAccountPlaylistsListWithToken (
  url: string,
  token: string,
  accountName: string,
  start: number,
  count: number,
  playlistType?: VideoPlaylistType,
  sort?: string
) {
  const path = '/api/v1/accounts/' + accountName + '/video-playlists'

  const query = {
    start,
    count,
    playlistType,
    sort
  }

  return makeGetRequest({
    url,
    token,
    path,
    query,
    statusCodeExpected: 200
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

function getVideoPlaylistWithToken (url: string, token: string, playlistId: number | string, statusCodeExpected = 200) {
  const path = '/api/v1/video-playlists/' + playlistId

  return makeGetRequest({
    url,
    token,
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
  url: string
  token: string
  playlistAttrs: VideoPlaylistCreate
  expectedStatus?: number
}) {
  const path = '/api/v1/video-playlists'

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
  url: string
  token: string
  playlistAttrs: VideoPlaylistUpdate
  playlistId: number | string
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

async function addVideoInPlaylist (options: {
  url: string
  token: string
  playlistId: number | string
  elementAttrs: VideoPlaylistElementCreate | { videoId: string }
  expectedStatus?: number
}) {
  options.elementAttrs.videoId = await videoUUIDToId(options.url, options.elementAttrs.videoId)

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
  url: string
  token: string
  playlistId: number | string
  playlistElementId: number | string
  elementAttrs: VideoPlaylistElementUpdate
  expectedStatus?: number
}) {
  const path = '/api/v1/video-playlists/' + options.playlistId + '/videos/' + options.playlistElementId

  return makePutBodyRequest({
    url: options.url,
    path,
    token: options.token,
    fields: options.elementAttrs,
    statusCodeExpected: options.expectedStatus || 204
  })
}

function removeVideoFromPlaylist (options: {
  url: string
  token: string
  playlistId: number | string
  playlistElementId: number
  expectedStatus?: number
}) {
  const path = '/api/v1/video-playlists/' + options.playlistId + '/videos/' + options.playlistElementId

  return makeDeleteRequest({
    url: options.url,
    path,
    token: options.token,
    statusCodeExpected: options.expectedStatus || 204
  })
}

function reorderVideosPlaylist (options: {
  url: string
  token: string
  playlistId: number | string
  elementAttrs: {
    startPosition: number
    insertAfterPosition: number
    reorderLength?: number
  }
  expectedStatus?: number
}) {
  const path = '/api/v1/video-playlists/' + options.playlistId + '/videos/reorder'

  return makePostBodyRequest({
    url: options.url,
    path,
    token: options.token,
    fields: options.elementAttrs,
    statusCodeExpected: options.expectedStatus || 204
  })
}

async function checkPlaylistFilesWereRemoved (
  playlistUUID: string,
  internalServerNumber: number,
  directories = [ 'thumbnails' ]
) {
  const testDirectory = 'test' + internalServerNumber

  for (const directory of directories) {
    const directoryPath = join(root(), testDirectory, directory)

    const files = await readdir(directoryPath)
    for (const file of files) {
      expect(file).to.not.contain(playlistUUID)
    }
  }
}

function getVideoPlaylistPrivacies (url: string) {
  const path = '/api/v1/video-playlists/privacies'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: 200
  })
}

function doVideosExistInMyPlaylist (url: string, token: string, videoIds: number[]) {
  const path = '/api/v1/users/me/video-playlists/videos-exist'

  return makeGetRequest({
    url,
    token,
    path,
    query: { videoIds },
    statusCodeExpected: 200
  })
}

// ---------------------------------------------------------------------------

export {
  getVideoPlaylistPrivacies,

  getVideoPlaylistsList,
  getVideoChannelPlaylistsList,
  getAccountPlaylistsList,
  getAccountPlaylistsListWithToken,

  getVideoPlaylist,
  getVideoPlaylistWithToken,

  createVideoPlaylist,
  updateVideoPlaylist,
  deleteVideoPlaylist,

  addVideoInPlaylist,
  updateVideoPlaylistElement,
  removeVideoFromPlaylist,

  reorderVideosPlaylist,

  checkPlaylistFilesWereRemoved,

  doVideosExistInMyPlaylist
}
