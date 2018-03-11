import * as request from 'supertest'
import * as urlUtil from 'url'

function getClient (url: string) {
  const path = '/api/v1/oauth-clients/local'

  return request(url)
          .get(path)
          .set('Host', urlUtil.parse(url).host)
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

// ---------------------------------------------------------------------------

export {
  getClient
}
