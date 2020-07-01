import * as request from 'supertest'
import { AbusePredefinedReasonsString, AbuseState, AbuseUpdate, AbuseVideoIs } from '@shared/models'
import { makeDeleteRequest, makeGetRequest, makePutBodyRequest } from '../requests/requests'

// FIXME: deprecated in 2.3. Remove this file

function reportVideoAbuse (
  url: string,
  token: string,
  videoId: number | string,
  reason: string,
  predefinedReasons?: AbusePredefinedReasonsString[],
  startAt?: number,
  endAt?: number,
  specialStatus = 200
) {
  const path = '/api/v1/videos/' + videoId + '/abuse'

  return request(url)
          .post(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + token)
          .send({ reason, predefinedReasons, startAt, endAt })
          .expect(specialStatus)
}

function getVideoAbusesList (options: {
  url: string
  token: string
  id?: number
  predefinedReason?: AbusePredefinedReasonsString
  search?: string
  state?: AbuseState
  videoIs?: AbuseVideoIs
  searchReporter?: string
  searchReportee?: string
  searchVideo?: string
  searchVideoChannel?: string
}) {
  const {
    url,
    token,
    id,
    predefinedReason,
    search,
    state,
    videoIs,
    searchReporter,
    searchReportee,
    searchVideo,
    searchVideoChannel
  } = options
  const path = '/api/v1/videos/abuse'

  const query = {
    sort: 'createdAt',
    id,
    predefinedReason,
    search,
    state,
    videoIs,
    searchReporter,
    searchReportee,
    searchVideo,
    searchVideoChannel
  }

  return makeGetRequest({
    url,
    path,
    token,
    query,
    statusCodeExpected: 200
  })
}

function updateVideoAbuse (
  url: string,
  token: string,
  videoId: string | number,
  videoAbuseId: number,
  body: AbuseUpdate,
  statusCodeExpected = 204
) {
  const path = '/api/v1/videos/' + videoId + '/abuse/' + videoAbuseId

  return makePutBodyRequest({
    url,
    token,
    path,
    fields: body,
    statusCodeExpected
  })
}

function deleteVideoAbuse (url: string, token: string, videoId: string | number, videoAbuseId: number, statusCodeExpected = 204) {
  const path = '/api/v1/videos/' + videoId + '/abuse/' + videoAbuseId

  return makeDeleteRequest({
    url,
    token,
    path,
    statusCodeExpected
  })
}

// ---------------------------------------------------------------------------

export {
  reportVideoAbuse,
  getVideoAbusesList,
  updateVideoAbuse,
  deleteVideoAbuse
}
