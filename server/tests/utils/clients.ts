import * as request from 'supertest'

function getClient (url: string) {
  const path = '/api/v1/oauth-clients/local'

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

// ---------------------------------------------------------------------------

export {
  getClient
}
