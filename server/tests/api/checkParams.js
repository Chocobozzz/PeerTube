'use strict'

const async = require('async')
const chai = require('chai')
const expect = chai.expect
const pathUtils = require('path')
const request = require('supertest')

const utils = require('./utils')

describe('Test parameters validator', function () {
  let server = null

  function makePostRequest (path, token, fields, attach, done, fail) {
    let statusCode = 400
    if (fail !== undefined && fail === false) statusCode = 200

    const req = request(server.url)
      .post(path)
      .set('Accept', 'application/json')

    if (token) req.set('Authorization', 'Bearer ' + token)

    Object.keys(fields).forEach(function (field) {
      const value = fields[field]
      req.field(field, value)
    })

    req.expect(statusCode, done)
  }

  function makePostBodyRequest (path, fields, done, fail) {
    let statusCode = 400
    if (fail !== undefined && fail === false) statusCode = 200

    request(server.url)
      .post(path)
      .set('Accept', 'application/json')
      .send(fields)
      .expect(statusCode, done)
  }

  // ---------------------------------------------------------------

  before(function (done) {
    this.timeout(20000)

    async.series([
      function (next) {
        utils.flushTests(next)
      },
      function (next) {
        utils.runServer(1, function (server1) {
          server = server1

          next()
        })
      },
      function (next) {
        utils.loginAndGetAccessToken(server, function (err, token) {
          if (err) throw err
          server.access_token = token

          next()
        })
      }
    ], done)
  })

  describe('Of the pods API', function () {
    const path = '/api/v1/pods/'

    describe('When adding a pod', function () {
      it('Should fail with nothing', function (done) {
        const data = {}
        makePostBodyRequest(path, data, done)
      })

      it('Should fail without public key', function (done) {
        const data = {
          data: {
            url: 'http://coucou.com'
          }
        }
        makePostBodyRequest(path, data, done)
      })

      it('Should fail without an url', function (done) {
        const data = {
          data: {
            publicKey: 'mysuperpublickey'
          }
        }
        makePostBodyRequest(path, data, done)
      })

      it('Should fail with an incorrect url', function (done) {
        const data = {
          data: {
            url: 'coucou.com',
            publicKey: 'mysuperpublickey'
          }
        }
        makePostBodyRequest(path, data, function () {
          data.data.url = 'http://coucou'
          makePostBodyRequest(path, data, function () {
            data.data.url = 'coucou'
            makePostBodyRequest(path, data, done)
          })
        })
      })

      it('Should succeed with the correct parameters', function (done) {
        const data = {
          data: {
            url: 'http://coucou.com',
            publicKey: 'mysuperpublickey'
          }
        }
        makePostBodyRequest(path, data, done, false)
      })
    })
  })

  describe('Of the videos API', function () {
    const path = '/api/v1/videos/'

    describe('When searching a video', function () {
      it('Should fail with nothing', function (done) {
        request(server.url)
          .get(pathUtils.join(path, 'search'))
          .set('Accept', 'application/json')
          .expect(400, done)
      })
    })

    describe('When adding a video', function () {
      it('Should fail with nothing', function (done) {
        const data = {}
        const attach = {}
        makePostRequest(path, server.access_token, data, attach, done)
      })

      it('Should fail without name', function (done) {
        const data = {
          description: 'my super description'
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short.webm')
        }
        makePostRequest(path, server.access_token, data, attach, done)
      })

      it('Should fail with a long name', function (done) {
        const data = {
          name: 'My very very very very very very very very very very very very very very very very long name',
          description: 'my super description'
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short.webm')
        }
        makePostRequest(path, server.access_token, data, attach, done)
      })

      it('Should fail without description', function (done) {
        const data = {
          name: 'my super name'
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short.webm')
        }
        makePostRequest(path, server.access_token, data, attach, done)
      })

      it('Should fail with a long description', function (done) {
        const data = {
          name: 'my super name',
          description: 'my super description which is very very very very very very very very very very very very very very' +
                       'very very very very very very very very very very very very very very very very very very very very very' +
                       'very very very very very very very very very very very very very very very long'
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short.webm')
        }
        makePostRequest(path, server.access_token, data, attach, done)
      })

      it('Should fail without an input file', function (done) {
        const data = {
          name: 'my super name',
          description: 'my super description'
        }
        const attach = {}
        makePostRequest(path, server.access_token, data, attach, done)
      })

      it('Should fail without an incorrect input file', function (done) {
        const data = {
          name: 'my super name',
          description: 'my super description'
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, '..', 'fixtures', 'video_short_fake.webm')
        }
        makePostRequest(path, server.access_token, data, attach, done)
      })

      it('Should succeed with the correct parameters', function (done) {
        const data = {
          name: 'my super name',
          description: 'my super description'
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short.webm')
        }
        makePostRequest(path, server.access_token, data, attach, function () {
          attach.videofile = pathUtils.join(__dirname, 'fixtures', 'video_short.mp4')
          makePostRequest(path, server.access_token, data, attach, function () {
            attach.videofile = pathUtils.join(__dirname, 'fixtures', 'video_short.ogv')
            makePostRequest(path, server.access_token, data, attach, done, true)
          }, true)
        }, true)
      })
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

            expect(res.body).to.be.an('array')
            expect(res.body.length).to.equal(0)

            done()
          })
      })

      it('Should fail without a mongodb id', function (done) {
        request(server.url)
          .get(path + 'coucou')
          .set('Accept', 'application/json')
          .expect(400, done)
      })

      it('Should return 404 with an incorrect video', function (done) {
        request(server.url)
          .get(path + '123456789012345678901234')
          .set('Accept', 'application/json')
          .expect(404, done)
      })

      it('Should succeed with the correct parameters')
    })

    describe('When removing a video', function () {
      it('Should have 404 with nothing', function (done) {
        request(server.url)
          .delete(path)
          .set('Authorization', 'Bearer ' + server.access_token)
          .expect(400, done)
      })

      it('Should fail without a mongodb id', function (done) {
        request(server.url)
          .delete(path + 'hello')
          .set('Authorization', 'Bearer ' + server.access_token)
          .expect(400, done)
      })

      it('Should fail with a video which does not exist', function (done) {
        request(server.url)
          .delete(path + '123456789012345678901234')
          .set('Authorization', 'Bearer ' + server.access_token)
          .expect(404, done)
      })

      it('Should fail with a video of another pod')

      it('Should succeed with the correct parameters')
    })
  })

  describe('Of the remote videos API', function () {
    describe('When making a secure request', function () {
      it('Should check a secure request')
    })

    describe('When adding a video', function () {
      it('Should check when adding a video')
    })

    describe('When removing a video', function () {
      it('Should check when removing a video')
    })
  })

  after(function (done) {
    process.kill(-server.app.pid)

    // Keep the logs if the test failed
    if (this.ok) {
      utils.flushTests(done)
    } else {
      done()
    }
  })
})
