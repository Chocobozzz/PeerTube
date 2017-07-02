/* eslint-disable no-unused-expressions */

'use strict'

const series = require('async/series')

const loginUtils = require('../../utils/login')
const requestsUtils = require('../../utils/requests')
const serversUtils = require('../../utils/servers')
const usersUtils = require('../../utils/users')
const videosUtils = require('../../utils/videos')

describe('Test video blacklists API validators', function () {
  let server = null
  let userAccessToken = null

  // ---------------------------------------------------------------

  before(function (done) {
    this.timeout(120000)

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
        const username = 'user1'
        const password = 'my super password'

        usersUtils.createUser(server.url, server.accessToken, username, password, next)
      },
      function (next) {
        const user = {
          username: 'user1',
          password: 'my super password'
        }

        loginUtils.getUserAccessToken(server, user, function (err, accessToken) {
          if (err) throw err

          userAccessToken = accessToken

          next()
        })
      },
      // Upload a video
      function (next) {
        const videoAttributes = {}
        videosUtils.uploadVideo(server.url, server.accessToken, videoAttributes, next)
      },
      function (next) {
        videosUtils.getVideosList(server.url, function (err, res) {
          if (err) throw err

          const videos = res.body.data
          server.video = videos[0]

          next()
        })
      }
    ], done)
  })

  describe('When adding a video in blacklist', function () {
    const basePath = '/api/v1/videos/'

    it('Should fail with nothing', function (done) {
      const path = basePath + server.video + '/blacklist'
      const data = {}
      requestsUtils.makePostBodyRequest(server.url, path, server.accessToken, data, done)
    })

    it('Should fail with a wrong video', function (done) {
      const wrongPath = '/api/v1/videos/blabla/blacklist'
      const data = {}
      requestsUtils.makePostBodyRequest(server.url, wrongPath, server.accessToken, data, done)
    })

    it('Should fail with a non authenticated user', function (done) {
      const data = {}
      const path = basePath + server.video + '/blacklist'
      requestsUtils.makePostBodyRequest(server.url, path, 'hello', data, done, 401)
    })

    it('Should fail with a non admin user', function (done) {
      const data = {}
      const path = basePath + server.video + '/blacklist'
      requestsUtils.makePostBodyRequest(server.url, path, userAccessToken, data, done, 403)
    })

    it('Should fail with a local video', function (done) {
      const data = {}
      const path = basePath + server.video.id + '/blacklist'
      requestsUtils.makePostBodyRequest(server.url, path, server.accessToken, data, done, 403)
    })
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
