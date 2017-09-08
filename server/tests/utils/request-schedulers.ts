import * as request from 'supertest'

import { ServerInfo } from '../utils'

function getRequestsStats (server: ServerInfo) {
  const path = '/api/v1/request-schedulers/stats'

  return request(server.url)
          .get(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + server.accessToken)
          .expect(200)
          .expect('Content-Type', /json/)
}

// ---------------------------------------------------------------------------

export {
  getRequestsStats
}
