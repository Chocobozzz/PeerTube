import * as request from 'supertest'

function makeActivityPubGetRequest (url: string, path: string) {
  return request(url)
    .get(path)
    .set('Accept', 'application/activity+json,text/html;q=0.9,\\*/\\*;q=0.8')
    .expect(200)
    .expect('Content-Type', /json/)
}

// ---------------------------------------------------------------------------

export {
  makeActivityPubGetRequest
}
