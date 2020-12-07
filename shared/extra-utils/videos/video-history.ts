import { makeGetRequest, makePostBodyRequest, makePutBodyRequest } from '../requests/requests'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

function userWatchVideo (
  url: string,
  token: string,
  videoId: number | string,
  currentTime: number,
  statusCodeExpected = HttpStatusCode.NO_CONTENT_204
) {
  const path = '/api/v1/videos/' + videoId + '/watching'
  const fields = { currentTime }

  return makePutBodyRequest({ url, path, token, fields, statusCodeExpected })
}

function listMyVideosHistory (url: string, token: string) {
  const path = '/api/v1/users/me/history/videos'

  return makeGetRequest({
    url,
    path,
    token,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

function removeMyVideosHistory (url: string, token: string, beforeDate?: string) {
  const path = '/api/v1/users/me/history/videos/remove'

  return makePostBodyRequest({
    url,
    path,
    token,
    fields: beforeDate ? { beforeDate } : {},
    statusCodeExpected: HttpStatusCode.NO_CONTENT_204
  })
}

// ---------------------------------------------------------------------------

export {
  userWatchVideo,
  listMyVideosHistory,
  removeMyVideosHistory
}
