import { makePutBodyRequest } from '../requests/requests'

function userWatchVideo (url: string, token: string, videoId: number | string, currentTime: number) {
  const path = '/api/v1/videos/' + videoId + '/watching'
  const fields = { currentTime }

  return makePutBodyRequest({ url, path, token, fields, statusCodeExpected: 204 })
}

// ---------------------------------------------------------------------------

export {
  userWatchVideo
}
