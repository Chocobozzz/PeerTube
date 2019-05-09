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

// ---------------------------------------------------------------------------

export {
  searchVideoChannel
}
