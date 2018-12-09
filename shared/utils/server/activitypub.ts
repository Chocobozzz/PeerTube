import * as request from 'supertest'

function makeActivityPubGetRequest (url: string, path: string, expectedStatus = 200) {
  return request(url)
    .get(path)
    .set('Accept', 'application/activity+json,text/html;q=0.9,\\*/\\*;q=0.8')
    .expect(expectedStatus)
}

// ---------------------------------------------------------------------------

export {
  makeActivityPubGetRequest
}
