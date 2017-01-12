'use strict'

const series = require('async/series')

const loginUtils = require('../../utils/login')
const serversUtils = require('../../utils/servers')

describe('Test remote videos API validators', function () {
  let server = null

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
      }
    ], done)
  })

  describe('When making a secure request', function () {
    it('Should check a secure request')
  })

  describe('When adding a video', function () {
    it('Should check when adding a video')
  })

  describe('When removing a video', function () {
    it('Should check when removing a video')
  })

  describe('When reporting abuse on a video', function () {
    it('Should check when reporting a video abuse')
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
