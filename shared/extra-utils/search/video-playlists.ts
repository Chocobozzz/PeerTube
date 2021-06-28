import { VideoPlaylistsSearchQuery } from '@shared/models'
import { HttpStatusCode } from '../../core-utils/miscs/http-error-codes'
import { makeGetRequest } from '../requests/requests'

function searchVideoPlaylists (url: string, search: string, token?: string, statusCodeExpected = HttpStatusCode.OK_200) {
  const path = '/api/v1/search/video-playlists'

  return makeGetRequest({
    url,
    path,
    query: {
      sort: '-createdAt',
      search
    },
    token,
    statusCodeExpected
  })
}

function advancedVideoPlaylistSearch (url: string, search: VideoPlaylistsSearchQuery) {
  const path = '/api/v1/search/video-playlists'

  return makeGetRequest({
    url,
    path,
    query: search,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

// ---------------------------------------------------------------------------

export {
  searchVideoPlaylists,
  advancedVideoPlaylistSearch
}
