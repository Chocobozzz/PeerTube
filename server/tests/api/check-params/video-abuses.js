/* eslint-disable no-unused-expressions */

'use strict'

const request = require('supertest')
const series = require('async/series')

const loginUtils = require('../../utils/login')
const requestsUtils = require('../../utils/requests')
const serversUtils = require('../../utils/servers')
const usersUtils = require('../../utils/users')
const videosUtils = require('../../utils/videos')

describe('Test video abuses API validators', function () {
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
      // Upload some videos on each pods
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

  describe('When listing video abuses', function () {
    const path = '/api/v1/videos/abuse'

    it('Should fail with a bad start pagination', function (done) {
      request(server.url)
        .get(path)
        .query({ start: 'hello' })
        .set('Authorization', 'Bearer ' + server.accessToken)
        .set('Accept', 'application/json')
        .expect(400, done)
    })

    it('Should fail with a bad count pagination', function (done) {
      request(server.url)
        .get(path)
        .query({ count: 'hello' })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(400, done)
    })

    it('Should fail with an incorrect sort', function (done) {
      request(server.url)
        .get(path)
        .query({ sort: 'hello' })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(400, done)
    })

    it('Should fail with a non authenticated user', function (done) {
      request(server.url)
        .get(path)
        .query({ sort: 'hello' })
        .set('Accept', 'application/json')
        .expect(401, done)
    })

    it('Should fail with a non admin user', function (done) {
      request(server.url)
        .get(path)
        .query({ sort: 'hello' })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + userAccessToken)
        .expect(403, done)
    })
  })

  describe('When reporting a video abuse', function () {
    const basePath = '/api/v1/videos/'

    it('Should fail with nothing', function (done) {
      const path = basePath + server.video + '/abuse'
      const data = {}
      requestsUtils.makePostBodyRequest(server.url, path, server.accessToken, data, done)
    })

    it('Should fail with a wrong video', function (done) {
      const wrongPath = '/api/v1/videos/blabla/abuse'
      const data = {}
      requestsUtils.makePostBodyRequest(server.url, wrongPath, server.accessToken, data, done)
    })

    it('Should fail with a non authenticated user', function (done) {
      const data = {}
      const path = basePath + server.video + '/abuse'
      requestsUtils.makePostBodyRequest(server.url, path, 'hello', data, done, 401)
    })

    it('Should fail with a reason too short', function (done) {
      const data = {
        reason: 'h'
      }
      const path = basePath + server.video + '/abuse'
      requestsUtils.makePostBodyRequest(server.url, path, server.accessToken, data, done)
    })

    it('Should fail with a reason too big', function (done) {
      const data = {
        reason: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' +
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' +
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' +
                '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      }
      const path = basePath + server.video + '/abuse'
      requestsUtils.makePostBodyRequest(server.url, path, server.accessToken, data, done)
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
