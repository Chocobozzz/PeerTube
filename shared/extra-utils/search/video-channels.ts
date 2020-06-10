import { VideoChannelsSearchQuery } from '@shared/models'
import { makeGetRequest } from '../requests/requests'

function searchVideoChannel (url: string, search: string, token?: string, statusCodeExpected = 200) {
  const path = '/api/v1/search/video-channels'

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

function advancedVideoChannelSearch (url: string, search: VideoChannelsSearchQuery) {
  const path = '/api/v1/search/video-channels'

  return makeGetRequest({
    url,
    path,
    query: search,
    statusCodeExpected: 200
  })
}

// ---------------------------------------------------------------------------

export {
  searchVideoChannel,
  advancedVideoChannelSearch
}
