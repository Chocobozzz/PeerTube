import * as request from 'supertest'
import { VideoAbuseUpdate } from '../../../../shared/models/videos/abuse/video-abuse-update.model'
import { makeDeleteRequest, makePutBodyRequest } from '..'

function reportVideoAbuse (url: string, token: string, videoId: number | string, reason: string, specialStatus = 200) {
  const path = '/api/v1/videos/' + videoId + '/abuse'

  return request(url)
          .post(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + token)
          .send({ reason })
          .expect(specialStatus)
}

function getVideoAbusesList (url: string, token: string) {
  const path = '/api/v1/videos/abuse'

  return request(url)
          .get(path)
          .query({ sort: 'createdAt' })
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + token)
          .expect(200)
          .expect('Content-Type', /json/)
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
