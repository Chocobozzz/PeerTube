import * as request from 'supertest'
import { VideoBlacklistType } from '../../models/videos'
import { makeGetRequest } from '..'

function addVideoToBlacklist (
  url: string,
  token: string,
  videoId: number | string,
  reason?: string,
  unfederate?: boolean,
  specialStatus = 204
) {
  const path = '/api/v1/videos/' + videoId + '/blacklist'

  return request(url)
    .post(path)
    .send({ reason, unfederate })
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(specialStatus)
}

function updateVideoBlacklist (url: string, token: string, videoId: number, reason?: string, specialStatus = 204) {
  const path = '/api/v1/videos/' + videoId + '/blacklist'

  return request(url)
    .put(path)
    .send({ reason })
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(specialStatus)
}

function removeVideoFromBlacklist (url: string, token: string, videoId: number | string, specialStatus = 204) {
  const path = '/api/v1/videos/' + videoId + '/blacklist'

  return request(url)
    .delete(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(specialStatus)
}

function getBlacklistedVideosList (parameters: {
  url: string
  token: string
  sort?: string
  type?: VideoBlacklistType
  specialStatus?: number
}) {
  const { url, token, sort, type, specialStatus = 200 } = parameters
  const path = '/api/v1/videos/blacklist/'

  const query = { sort, type }

  return makeGetRequest({
    url,
    path,
    query,
    token,
    statusCodeExpected: specialStatus
  })
}

// ---------------------------------------------------------------------------

export {
  addVideoToBlacklist,
  removeVideoFromBlacklist,
  getBlacklistedVideosList,
  updateVideoBlacklist
}
