'use strict'

const request = require('supertest')

const configsUtils = {
  getConfig
}

// ---------------------- Export functions --------------------

function getConfig (url, end) {
  const path = '/api/v1/config'

  request(url)
    .get(path)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

// ---------------------------------------------------------------------------

module.exports = configsUtils
