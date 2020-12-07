import * as request from 'supertest'
import { VideoBlacklistType } from '../../models/videos'
import { makeGetRequest } from '..'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

function addVideoToBlacklist (
  url: string,
  token: string,
  videoId: number | string,
  reason?: string,
  unfederate?: boolean,
  specialStatus = HttpStatusCode.NO_CONTENT_204
) {
  const path = '/api/v1/videos/' + videoId + '/blacklist'

  return request(url)
    .post(path)
    .send({ reason, unfederate })
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(specialStatus)
}

function updateVideoBlacklist (
  url: string,
  token: string,
  videoId: number,
  reason?: string,
  specialStatus = HttpStatusCode.NO_CONTENT_204
) {
  const path = '/api/v1/videos/' + videoId + '/blacklist'

  return request(url)
    .put(path)
    .send({ reason })
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(specialStatus)
}

function removeVideoFromBlacklist (url: string, token: string, videoId: number | string, specialStatus = HttpStatusCode.NO_CONTENT_204) {
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
  specialStatus?: HttpStatusCode
}) {
  const { url, token, sort, type, specialStatus = HttpStatusCode.OK_200 } = parameters
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
