import { makeGetRequest } from '../requests/requests'

function getVideosOverview (url: string, page: number, statusCodeExpected = 200) {
  const path = '/api/v1/overviews/videos'

  const query = { page }

  return makeGetRequest({
    url,
    path,
    query,
    statusCodeExpected
  })
}

function getVideosOverviewWithToken (url: string, page: number, token: string, statusCodeExpected = 200) {
  const path = '/api/v1/overviews/videos'

  const query = { page }

  return makeGetRequest({
    url,
    path,
    query,
    token,
    statusCodeExpected
  })
}

export {
  getVideosOverview,
  getVideosOverviewWithToken
}
