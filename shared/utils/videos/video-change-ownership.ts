import * as request from 'supertest'

function changeVideoOwnership (url: string, token: string, videoId: number | string, username, expectedStatus = 204) {
  const path = '/api/v1/videos/' + videoId + '/give-ownership'

  return request(url)
    .post(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .send({ username })
    .expect(expectedStatus)
}

function getVideoChangeOwnershipList (url: string, token: string) {
  const path = '/api/v1/videos/ownership'

  return request(url)
    .get(path)
    .query({ sort: '-createdAt' })
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(200)
    .expect('Content-Type', /json/)
}

function acceptChangeOwnership (url: string, token: string, ownershipId: string, channelId: number, expectedStatus = 204) {
  const path = '/api/v1/videos/ownership/' + ownershipId + '/accept'

  return request(url)
    .post(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .send({ channelId })
    .expect(expectedStatus)
}

function refuseChangeOwnership (url: string, token: string, ownershipId: string, expectedStatus = 204) {
  const path = '/api/v1/videos/ownership/' + ownershipId + '/refuse'

  return request(url)
    .post(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(expectedStatus)
}

// ---------------------------------------------------------------------------

export {
  changeVideoOwnership,
  getVideoChangeOwnershipList,
  acceptChangeOwnership,
  refuseChangeOwnership
}
