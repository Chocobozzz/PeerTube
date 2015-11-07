;(function () {
  'use strict'

  var request = require('supertest')
  var chai = require('chai')
  var expect = chai.expect

  var utils = require('../utils')

  describe('Test parameters validator', function () {
    var app = null
    var url = ''

    before(function (done) {
      this.timeout(20000)

      utils.flushTests(function () {
        utils.runServer(1, function (app1, url1) {
          app = app1
          url = url1
          done()
        })
      })
    })

    function makePostRequest (path, fields, attach, done, fail) {
      var status_code = 400
      if (fail !== undefined && fail === false) status_code = 200

      var req = request(url)
        .post(path)
        .set('Accept', 'application/json')

      Object.keys(fields).forEach(function (field) {
        var value = fields[field]
        req.field(field, value)
      })

      req.expect(status_code, done)
    }

    function makePostBodyRequest (path, fields, done, fail) {
      var status_code = 400
      if (fail !== undefined && fail === false) status_code = 200

      request(url)
        .post(path)
        .set('Accept', 'application/json')
        .send(fields)
        .expect(status_code, done)
    }

    describe('Of the pods API', function () {
      var path = '/api/v1/pods/'

      describe('When adding a pod', function () {
        it('Should fail with nothing', function (done) {
          var data = {}
          makePostBodyRequest(path, data, done)
        })

        it('Should fail without public key', function (done) {
          var data = {
            data: {
              url: 'http://coucou.com'
            }
          }
          makePostBodyRequest(path, data, done)
        })

        it('Should fail without an url', function (done) {
          var data = {
            data: {
              publicKey: 'mysuperpublickey'
            }
          }
          makePostBodyRequest(path, data, done)
        })

        it('Should fail with an incorrect url', function (done) {
          var data = {
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
          var data = {
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
      var path = '/api/v1/videos/'

      describe('When searching a video', function () {
        it('Should fail with nothing', function (done) {
          request(url)
            .get(path + '/search/')
            .set('Accept', 'application/json')
            .expect(400, done)
        })
      })

      describe('When adding a video', function () {
        it('Should fail with nothing', function (done) {
          var data = {}
          var attach = {}
          makePostRequest(path, data, attach, done)
        })

        it('Should fail without name', function (done) {
          var data = {
            description: 'my super description'
          }
          var attach = {
            'input_video': __dirname + '/../fixtures/video_short.webm'
          }
          makePostRequest(path, data, attach, done)
        })

        it('Should fail with a long name', function (done) {
          var data = {
            name: 'My very very very very very very very very very very very very very very very very long name',
            description: 'my super description'
          }
          var attach = {
            'input_video': __dirname + '/../fixtures/video_short.webm'
          }
          makePostRequest(path, data, attach, done)
        })

        it('Should fail without description', function (done) {
          var data = {
            name: 'my super name'
          }
          var attach = {
            'input_video': __dirname + '/../fixtures/video_short.webm'
          }
          makePostRequest(path, data, attach, done)
        })

        it('Should fail with a long description', function (done) {
          var data = {
            name: 'my super name',
            description: 'my super description which is very very very very very very very very very very very very very very' +
                         'very very very very very very very very very very very very very very very very very very very very very' +
                         'very very very very very very very very very very very very very very very long'
          }
          var attach = {
            'input_video': __dirname + '/../fixtures/video_short.webm'
          }
          makePostRequest(path, data, attach, done)
        })

        it('Should fail without an input file', function (done) {
          var data = {
            name: 'my super name',
            description: 'my super description'
          }
          var attach = {}
          makePostRequest(path, data, attach, done)
        })

        it('Should fail without an incorrect input file', function (done) {
          var data = {
            name: 'my super name',
            description: 'my super description'
          }
          var attach = {
            'input_video': __dirname + '/../fixtures/video_short_fake.webm'
          }
          makePostRequest(path, data, attach, done)
        })

        it('Should succeed with the correct parameters', function (done) {
          var data = {
            name: 'my super name',
            description: 'my super description'
          }
          var attach = {
            'input_video': __dirname + '/../fixtures/video_short.webm'
          }
          makePostRequest(path, data, attach, function () {
            attach.input_video = __dirname + '/../fixtures/video_short.mp4'
            makePostRequest(path, data, attach, function () {
              attach.input_video = __dirname + '/../fixtures/video_short.ogv'
              makePostRequest(path, data, attach, done, true)
            }, true)
          }, true)
        })
      })

      describe('When getting a video', function () {
        it('Should return the list of the videos with nothing', function (done) {
          request(url)
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
          request(url)
            .get(path + 'coucou')
            .set('Accept', 'application/json')
            .expect(400, done)
        })

        it('Should return 404 with an incorrect video', function (done) {
          request(url)
            .get(path + '123456789012345678901234')
            .set('Accept', 'application/json')
            .expect(404, done)
        })

        it('Should succeed with the correct parameters')
      })

      describe('When removing a video', function () {
        it('Should have 404 with nothing', function (done) {
          request(url)
          .delete(path)
          .expect(404, done)
        })

        it('Should fail without a mongodb id', function (done) {
          request(url)
            .delete(path + 'hello')
            .expect(400, done)
        })

        it('Should fail with a video which does not exist', function (done) {
          request(url)
            .delete(path + '123456789012345678901234')
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
      process.kill(-app.pid)

      // Keep the logs if the test failed
      if (this.ok) {
        utils.flushTests(function () {
          done()
        })
      } else {
        done()
      }
    })
  })
})()
