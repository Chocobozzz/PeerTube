'use strict'

const request = require('supertest')

const clientsUtils = {
  getClient: getClient
}

// ---------------------- Export functions --------------------

function getClient (url, end) {
  const path = '/api/v1/users/client'

  request(url)
    .get(path)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

// ---------------------------------------------------------------------------

module.exports = clientsUtils
