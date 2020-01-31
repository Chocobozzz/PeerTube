import { makeDeleteRequest, makeGetRequest, makePostBodyRequest, makePutBodyRequest } from '../requests/requests'
import { VideoRedundanciesTarget } from '@shared/models'

function updateRedundancy (url: string, accessToken: string, host: string, redundancyAllowed: boolean, expectedStatus = 204) {
  const path = '/api/v1/server/redundancy/' + host

  return makePutBodyRequest({
    url,
    path,
    token: accessToken,
    fields: { redundancyAllowed },
    statusCodeExpected: expectedStatus
  })
}

function listVideoRedundancies (options: {
  url: string
  accessToken: string
  target: VideoRedundanciesTarget
  start?: number
  count?: number
  sort?: string
  statusCodeExpected?: number
}) {
  const path = '/api/v1/server/redundancy/videos'

  const { url, accessToken, target, statusCodeExpected, start, count, sort } = options

  return makeGetRequest({
    url,
    token: accessToken,
    path,
    query: {
      start: start ?? 0,
      count: count ?? 5,
      sort: sort ?? 'name',
      target
    },
    statusCodeExpected: statusCodeExpected || 200
  })
}

function addVideoRedundancy (options: {
  url: string
  accessToken: string
  videoId: number
}) {
  const path = '/api/v1/server/redundancy/videos'
  const { url, accessToken, videoId } = options

  return makePostBodyRequest({
    url,
    token: accessToken,
    path,
    fields: { videoId },
    statusCodeExpected: 204
  })
}

function removeVideoRedundancy (options: {
  url: string
  accessToken: string
  redundancyId: number
}) {
  const { url, accessToken, redundancyId } = options
  const path = '/api/v1/server/redundancy/videos/' + redundancyId

  return makeDeleteRequest({
    url,
    token: accessToken,
    path,
    statusCodeExpected: 204
  })
}

export {
  updateRedundancy,
  listVideoRedundancies,
  addVideoRedundancy,
  removeVideoRedundancy
}
