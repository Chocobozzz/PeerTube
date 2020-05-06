import * as request from 'supertest'
import { VideoAbuseUpdate } from '../../models/videos/abuse/video-abuse-update.model'
import { makeDeleteRequest, makePutBodyRequest, makeGetRequest } from '../requests/requests'
import { VideoAbuseState } from '@shared/models'
import { VideoAbuseVideoIs } from '@shared/models/videos/abuse/video-abuse-video-is.type'

function reportVideoAbuse (url: string, token: string, videoId: number | string, reason: string, specialStatus = 200) {
  const path = '/api/v1/videos/' + videoId + '/abuse'

  return request(url)
          .post(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + token)
          .send({ reason })
          .expect(specialStatus)
}

function getVideoAbusesList (options: {
  url: string
  token: string
  id?: number
  search?: string
  state?: VideoAbuseState
  videoIs?: VideoAbuseVideoIs
  searchReporter?: string
  searchReportee?: string
  searchVideo?: string
  searchVideoChannel?: string
}) {
  const {
    url,
    token,
    id,
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
  body: VideoAbuseUpdate,
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
