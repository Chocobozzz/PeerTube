import * as request from 'supertest'

function addVideoToBlacklist (url: string, token: string, videoId: number, specialStatus = 204) {
  const path = '/api/v1/videos/' + videoId + '/blacklist'

  return request(url)
          .post(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + token)
          .expect(specialStatus)
}

// ---------------------------------------------------------------------------

export {
  addVideoToBlacklist
}
