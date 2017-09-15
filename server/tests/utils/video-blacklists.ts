import * as request from 'supertest'

function addVideoToBlacklist (url: string, token: string, videoId: number, specialStatus = 204) {
  const path = '/api/v1/videos/' + videoId + '/blacklist'

  return request(url)
          .post(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + token)
          .expect(specialStatus)
}

function getBlacklistedVideosList (url: string, token: string, specialStatus = 200) {
  const path = '/api/v1/blacklists/'

  request(url)
    .get(path)
    .query({ sort: 'createdAt' })
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(specialStatus)
    .expect('Content-Type', /json/)
}

function getSortedBlacklistedVideosList (url: string, token: string, sort: string, specialStatus = 200) {
  const path = '/api/v1/blacklists/'

  request(url)
    .get(path)
    .query({ sort: sort })
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(specialStatus)
    .expect('Content-Type', /json/)
}

// ---------------------------------------------------------------------------

export {
  addVideoToBlacklist,
  getBlacklistedVideosList,
  getSortedBlacklistedVideosList
}
