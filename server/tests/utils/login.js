'use strict'

const request = require('supertest')

const loginUtils = {
  login,
  loginAndGetAccessToken,
  getUserAccessToken
}

// ---------------------- Export functions --------------------

function login (url, client, user, expectedStatus, end) {
  if (!end) {
    end = expectedStatus
    expectedStatus = 200
  }

  const path = '/api/v1/users/token'

  const body = {
    client_id: client.id,
    client_secret: client.secret,
    username: user.username,
    password: user.password,
    response_type: 'code',
    grant_type: 'password',
    scope: 'upload'
  }

  request(url)
    .post(path)
    .type('form')
    .send(body)
    .expect(expectedStatus)
    .end(end)
}

function loginAndGetAccessToken (server, callback) {
  login(server.url, server.client, server.user, 200, function (err, res) {
    if (err) return callback(err)

    return callback(null, res.body.access_token)
  })
}

function getUserAccessToken (server, user, callback) {
  login(server.url, server.client, user, 200, function (err, res) {
    if (err) return callback(err)

    return callback(null, res.body.access_token)
  })
}

// ---------------------------------------------------------------------------

module.exports = loginUtils
