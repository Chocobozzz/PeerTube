import { makeGetRequest, makePostBodyRequest, makePutBodyRequest } from '../requests/requests'

function userWatchVideo (url: string, token: string, videoId: number | string, currentTime: number, statusCodeExpected = 204) {
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
    statusCodeExpected: 200
  })
}

function removeMyVideosHistory (url: string, token: string, beforeDate?: string) {
  const path = '/api/v1/users/me/history/videos/remove'

  return makePostBodyRequest({
    url,
    path,
    token,
    fields: beforeDate ? { beforeDate } : {},
    statusCodeExpected: 204
  })
}

// ---------------------------------------------------------------------------

export {
  userWatchVideo,
  listMyVideosHistory,
  removeMyVideosHistory
}
