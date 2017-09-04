import * as request from 'supertest'

function getRequestsStats (server: { url: string }, accessToken: string) {
  const path = '/api/v1/requests/stats'

  return request(server.url)
          .get(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(200)
          .expect('Content-Type', /json/)
}

// ---------------------------------------------------------------------------

export {
  getRequestsStats
}
