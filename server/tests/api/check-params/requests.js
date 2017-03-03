/* eslint-disable no-unused-expressions */

'use strict'

const request = require('supertest')
const series = require('async/series')

const loginUtils = require('../../utils/login')
const usersUtils = require('../../utils/users')
const serversUtils = require('../../utils/servers')

describe('Test requests API validators', function () {
  const path = '/api/v1/requests/stats'
  let server = null
  let userAccessToken = null

  // ---------------------------------------------------------------

  before(function (done) {
    this.timeout(20000)

    series([
      function (next) {
        serversUtils.flushTests(next)
      },
      function (next) {
        serversUtils.runServer(1, function (server1) {
          server = server1

          next()
        })
      },
      function (next) {
        loginUtils.loginAndGetAccessToken(server, function (err, token) {
          if (err) throw err
          server.accessToken = token

          next()
        })
      },
      function (next) {
        const username = 'user'
        const password = 'my super password'

        usersUtils.createUser(server.url, server.accessToken, username, password, next)
      },
      function (next) {
        const user = {
          username: 'user',
          password: 'my super password'
        }

        loginUtils.getUserAccessToken(server, user, function (err, accessToken) {
          if (err) throw err

          userAccessToken = accessToken

          next()
        })
      }
    ], done)
  })

  it('Should fail with an non authenticated user', function (done) {
    request(server.url)
      .get(path)
      .set('Accept', 'application/json')
      .expect(401, done)
  })

  it('Should fail with a non admin user', function (done) {
    request(server.url)
      .get(path)
      .set('Authorization', 'Bearer ' + userAccessToken)
      .set('Accept', 'application/json')
      .expect(403, done)
  })

  after(function (done) {
    process.kill(-server.app.pid)

    // Keep the logs if the test failed
    if (this.ok) {
      serversUtils.flushTests(done)
    } else {
      done()
    }
  })
})
