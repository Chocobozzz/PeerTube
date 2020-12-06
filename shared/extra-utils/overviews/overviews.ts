import { makeGetRequest } from '../requests/requests'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

function getVideosOverview (url: string, page: number, statusCodeExpected = HttpStatusCode.OK_200) {
  const path = '/api/v1/overviews/videos'

  const query = { page }

  return makeGetRequest({
    url,
    path,
    query,
    statusCodeExpected
  })
}

function getVideosOverviewWithToken (url: string, page: number, token: string, statusCodeExpected = HttpStatusCode.OK_200) {
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
