import { VideoChannelsSearchQuery } from '@shared/models'
import { makeGetRequest } from '../requests/requests'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

function searchVideoChannel (url: string, search: string, token?: string, statusCodeExpected = HttpStatusCode.OK_200) {
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
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

// ---------------------------------------------------------------------------

export {
  searchVideoChannel,
  advancedVideoChannelSearch
}
