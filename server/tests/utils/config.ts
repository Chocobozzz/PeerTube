import * as request from 'supertest'

function getConfig (url: string) {
  const path = '/api/v1/config'

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

// ---------------------------------------------------------------------------

export {
  getConfig
}
