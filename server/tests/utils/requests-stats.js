'use strict'

const request = require('supertest')

const requestsStatsUtils = {
  getRequestsStats
}

// ---------------------- Export functions --------------------

function getRequestsStats (server, accessToken, callback) {
  const path = '/api/v1/requests/stats'

  request(server.url)
    .get(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .expect(200)
    .expect('Content-Type', /json/)
    .end(callback)
}

// ---------------------------------------------------------------------------

module.exports = requestsStatsUtils
