/* eslint-disable no-unused-expressions */

'use strict'

const chai = require('chai')
const expect = chai.expect
const pathUtils = require('path')
const request = require('supertest')
const series = require('async/series')

const loginUtils = require('../../utils/login')
const requestsUtils = require('../../utils/requests')
const serversUtils = require('../../utils/servers')
const videosUtils = require('../../utils/videos')

describe('Test videos API validator', function () {
  const path = '/api/v1/videos/'
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

  describe('When listing a video', function () {
    it('Should fail with a bad start pagination', function (done) {
      request(server.url)
        .get(path)
        .query({ start: 'hello' })
        .set('Accept', 'application/json')
        .expect(400, done)
    })

    it('Should fail with a bad count pagination', function (done) {
      request(server.url)
        .get(path)
        .query({ count: 'hello' })
        .set('Accept', 'application/json')
        .expect(400, done)
    })

    it('Should fail with an incorrect sort', function (done) {
      request(server.url)
        .get(path)
        .query({ sort: 'hello' })
        .set('Accept', 'application/json')
        .expect(400, done)
    })
  })

  describe('When searching a video', function () {
    it('Should fail with nothing', function (done) {
      request(server.url)
        .get(pathUtils.join(path, 'search'))
        .set('Accept', 'application/json')
        .expect(400, done)
    })

    it('Should fail with a bad start pagination', function (done) {
      request(server.url)
        .get(pathUtils.join(path, 'search', 'test'))
        .query({ start: 'hello' })
        .set('Accept', 'application/json')
        .expect(400, done)
    })

    it('Should fail with a bad count pagination', function (done) {
      request(server.url)
        .get(pathUtils.join(path, 'search', 'test'))
        .query({ count: 'hello' })
        .set('Accept', 'application/json')
        .expect(400, done)
    })

    it('Should fail with an incorrect sort', function (done) {
      request(server.url)
        .get(pathUtils.join(path, 'search', 'test'))
        .query({ sort: 'hello' })
        .set('Accept', 'application/json')
        .expect(400, done)
    })
  })

  describe('When adding a video', function () {
    it('Should fail with nothing', function (done) {
      const data = {}
      const attach = {}
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail without name', function (done) {
      const data = {
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail with a long name', function (done) {
      const data = {
        name: 'My very very very very very very very very very very very very very very very very long name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail without a category', function (done) {
      const data = {
        name: 'my super name',
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail with a bad category', function (done) {
      const data = {
        name: 'my super name',
        category: 125,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail without a licence', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail with a bad licence', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 125,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail with a bad language', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 4,
        language: 563,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail without nsfw attribute', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 4,
        language: 6,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail with a bad nsfw attribue', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 4,
        language: 6,
        nsfw: 2,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail without description', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        tags: [ 'tag1', 'tag2' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail with a long description', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description which is very very very very very very very very very very very very very very' +
                     'very very very very very very very very very very very very very very very very very very very very very' +
                     'very very very very very very very very very very very very very very very long',
        tags: [ 'tag1', 'tag2' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail with too many tags', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2', 'tag3', 'tag4' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail with a tag length too low', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 't' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail with a tag length too big', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'mysupertagtoolong', 'tag1' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail without an input file', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attach = {}
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail without an incorrect input file', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short_fake.webm')
      }
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should fail with a too big duration', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_too_long.webm')
      }
      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
    })

    it('Should succeed with the correct parameters', function (done) {
      this.timeout(5000)

      const data = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attach = {
        'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      this.timeout(10000)

      requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, function () {
        attach.videofile = pathUtils.join(__dirname, '..', 'fixtures', 'video_short.mp4')
        requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, function () {
          attach.videofile = pathUtils.join(__dirname, '..', 'fixtures', 'video_short.ogv')
          requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done, 204)
        }, false)
      }, false)
    })
  })

  describe('When updating a video', function () {
    let videoId

    before(function (done) {
      videosUtils.getVideosList(server.url, function (err, res) {
        if (err) throw err

        videoId = res.body.data[0].id

        return done()
      })
    })

    it('Should fail with nothing', function (done) {
      const data = {}
      requestsUtils.makePutBodyRequest(server.url, path, server.accessToken, data, done)
    })

    it('Should fail without a valid uuid', function (done) {
      const data = {
        category: 5,
        licence: 2,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      requestsUtils.makePutBodyRequest(server.url, path + 'blabla', server.accessToken, data, done)
    })

    it('Should fail with an unknown id', function (done) {
      const data = {
        category: 5,
        licence: 2,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      requestsUtils.makePutBodyRequest(server.url, path + '4da6fde3-88f7-4d16-b119-108df5630b06', server.accessToken, data, done, 404)
    })

    it('Should fail with a long name', function (done) {
      const data = {
        name: 'My very very very very very very very very very very very very very very very very long name',
        category: 5,
        licence: 2,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      requestsUtils.makePutBodyRequest(server.url, path + videoId, server.accessToken, data, done)
    })

    it('Should fail with a bad category', function (done) {
      const data = {
        name: 'my super name',
        category: 128,
        licence: 2,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      requestsUtils.makePutBodyRequest(server.url, path + videoId, server.accessToken, data, done)
    })

    it('Should fail with a bad licence', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 128,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      requestsUtils.makePutBodyRequest(server.url, path + videoId, server.accessToken, data, done)
    })

    it('Should fail with a bad language', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 3,
        language: 896,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      requestsUtils.makePutBodyRequest(server.url, path + videoId, server.accessToken, data, done)
    })

    it('Should fail with a bad nsfw attribute', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 5,
        language: 6,
        nsfw: -4,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      requestsUtils.makePutBodyRequest(server.url, path + videoId, server.accessToken, data, done)
    })

    it('Should fail with a long description', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 2,
        language: 6,
        nsfw: false,
        description: 'my super description which is very very very very very very very very very very very very very very' +
                     'very very very very very very very very very very very very very very very very very very very very very' +
                     'very very very very very very very very very very very very very very very long',
        tags: [ 'tag1', 'tag2' ]
      }
      requestsUtils.makePutBodyRequest(server.url, path + videoId, server.accessToken, data, done)
    })

    it('Should fail with too many tags', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 2,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2', 'tag3', 'tag4' ]
      }
      requestsUtils.makePutBodyRequest(server.url, path + videoId, server.accessToken, data, done)
    })

    it('Should fail with a tag length too low', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 2,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 't' ]
      }
      requestsUtils.makePutBodyRequest(server.url, path + videoId, server.accessToken, data, done)
    })

    it('Should fail with a tag length too big', function (done) {
      const data = {
        name: 'my super name',
        category: 5,
        licence: 2,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'mysupertagtoolong', 'tag1' ]
      }
      requestsUtils.makePutBodyRequest(server.url, path + videoId, server.accessToken, data, done)
    })

    it('Should fail with a video of another user')

    it('Should fail with a video of another pod')
  })

  describe('When getting a video', function () {
    it('Should return the list of the videos with nothing', function (done) {
      request(server.url)
        .get(path)
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function (err, res) {
          if (err) throw err

          expect(res.body.data).to.be.an('array')
          expect(res.body.data.length).to.equal(3)

          done()
        })
    })

    it('Should fail without a correct uuid', function (done) {
      request(server.url)
        .get(path + 'coucou')
        .set('Accept', 'application/json')
        .expect(400, done)
    })

    it('Should return 404 with an incorrect video', function (done) {
      request(server.url)
        .get(path + '4da6fde3-88f7-4d16-b119-108df5630b06')
        .set('Accept', 'application/json')
        .expect(404, done)
    })

    it('Should succeed with the correct parameters')
  })

  describe('When rating a video', function () {
    let videoId

    before(function (done) {
      videosUtils.getVideosList(server.url, function (err, res) {
        if (err) throw err

        videoId = res.body.data[0].id

        return done()
      })
    })

    it('Should fail without a valid uuid', function (done) {
      const data = {
        rating: 'like'
      }
      requestsUtils.makePutBodyRequest(server.url, path + 'blabla/rate', server.accessToken, data, done)
    })

    it('Should fail with an unknown id', function (done) {
      const data = {
        rating: 'like'
      }
      requestsUtils.makePutBodyRequest(server.url, path + '4da6fde3-88f7-4d16-b119-108df5630b06/rate', server.accessToken, data, done, 404)
    })

    it('Should fail with a wrong rating', function (done) {
      const data = {
        rating: 'likes'
      }
      requestsUtils.makePutBodyRequest(server.url, path + videoId + '/rate', server.accessToken, data, done)
    })

    it('Should succeed with the correct parameters', function (done) {
      const data = {
        rating: 'like'
      }
      requestsUtils.makePutBodyRequest(server.url, path + videoId + '/rate', server.accessToken, data, done, 204)
    })
  })

  describe('When removing a video', function () {
    it('Should have 404 with nothing', function (done) {
      request(server.url)
        .delete(path)
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(400, done)
    })

    it('Should fail without a correct uuid', function (done) {
      request(server.url)
        .delete(path + 'hello')
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(400, done)
    })

    it('Should fail with a video which does not exist', function (done) {
      request(server.url)
        .delete(path + '4da6fde3-88f7-4d16-b119-108df5630b06')
        .set('Authorization', 'Bearer ' + server.accessToken)
        .expect(404, done)
    })

    it('Should fail with a video of another user')

    it('Should fail with a video of another pod')

    it('Should succeed with the correct parameters')
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
