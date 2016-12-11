'use strict'

const chai = require('chai')
const expect = chai.expect
const pathUtils = require('path')
const request = require('supertest')
const series = require('async/series')

const loginUtils = require('../utils/login')
const requestsUtils = require('../utils/requests')
const serversUtils = require('../utils/servers')
const usersUtils = require('../utils/users')

describe('Test parameters validator', function () {
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
      }
    ], done)
  })

  describe('Of the pods API', function () {
    const path = '/api/v1/pods/'

    describe('When making friends', function () {
      let userAccessToken = null

      before(function (done) {
        usersUtils.createUser(server.url, server.accessToken, 'user1', 'password', function () {
          server.user = {
            username: 'user1',
            password: 'password'
          }

          loginUtils.loginAndGetAccessToken(server, function (err, accessToken) {
            if (err) throw err

            userAccessToken = accessToken

            done()
          })
        })
      })

      describe('When making friends', function () {
        const body = {
          hosts: [ 'localhost:9002' ]
        }

        it('Should fail without hosts', function (done) {
          request(server.url)
            .post(path + '/makefriends')
            .set('Authorization', 'Bearer ' + server.accessToken)
            .set('Accept', 'application/json')
            .expect(400, done)
        })

        it('Should fail if hosts is not an array', function (done) {
          request(server.url)
            .post(path + '/makefriends')
            .send({ hosts: 'localhost:9002' })
            .set('Authorization', 'Bearer ' + server.accessToken)
            .set('Accept', 'application/json')
            .expect(400, done)
        })

        it('Should fail if the array is not composed by hosts', function (done) {
          request(server.url)
            .post(path + '/makefriends')
            .send({ hosts: [ 'localhost:9002', 'localhost:coucou' ] })
            .set('Authorization', 'Bearer ' + server.accessToken)
            .set('Accept', 'application/json')
            .expect(400, done)
        })

        it('Should fail if the array is composed with http schemes', function (done) {
          request(server.url)
            .post(path + '/makefriends')
            .send({ hosts: [ 'localhost:9002', 'http://localhost:9003' ] })
            .set('Authorization', 'Bearer ' + server.accessToken)
            .set('Accept', 'application/json')
            .expect(400, done)
        })

        it('Should fail if hosts are not unique', function (done) {
          request(server.url)
            .post(path + '/makefriends')
            .send({ urls: [ 'localhost:9002', 'localhost:9002' ] })
            .set('Authorization', 'Bearer ' + server.accessToken)
            .set('Accept', 'application/json')
            .expect(400, done)
        })

        it('Should fail with a invalid token', function (done) {
          request(server.url)
            .post(path + '/makefriends')
            .send(body)
            .set('Authorization', 'Bearer faketoken')
            .set('Accept', 'application/json')
            .expect(401, done)
        })

        it('Should fail if the user is not an administrator', function (done) {
          request(server.url)
            .post(path + '/makefriends')
            .send(body)
            .set('Authorization', 'Bearer ' + userAccessToken)
            .set('Accept', 'application/json')
            .expect(403, done)
        })
      })

      describe('When quitting friends', function () {
        it('Should fail with a invalid token', function (done) {
          request(server.url)
            .get(path + '/quitfriends')
            .query({ start: 'hello' })
            .set('Authorization', 'Bearer faketoken')
            .set('Accept', 'application/json')
            .expect(401, done)
        })

        it('Should fail if the user is not an administrator', function (done) {
          request(server.url)
            .get(path + '/quitfriends')
            .query({ start: 'hello' })
            .set('Authorization', 'Bearer ' + userAccessToken)
            .set('Accept', 'application/json')
            .expect(403, done)
        })
      })
    })

    describe('When adding a pod', function () {
      it('Should fail with nothing', function (done) {
        const data = {}
        requestsUtils.makePostBodyRequest(server.url, path, null, data, done)
      })

      it('Should fail without public key', function (done) {
        const data = {
          host: 'coucou.com'
        }
        requestsUtils.makePostBodyRequest(server.url, path, null, data, done)
      })

      it('Should fail without an host', function (done) {
        const data = {
          publicKey: 'mysuperpublickey'
        }
        requestsUtils.makePostBodyRequest(server.url, path, null, data, done)
      })

      it('Should fail with an incorrect host', function (done) {
        const data = {
          host: 'http://coucou.com',
          publicKey: 'mysuperpublickey'
        }
        requestsUtils.makePostBodyRequest(server.url, path, null, data, function () {
          data.host = 'http://coucou'
          requestsUtils.makePostBodyRequest(server.url, path, null, data, function () {
            data.host = 'coucou'
            requestsUtils.makePostBodyRequest(server.url, path, null, data, done)
          })
        })
      })

      it('Should succeed with the correct parameters', function (done) {
        const data = {
          host: 'coucou.com',
          publicKey: 'mysuperpublickey'
        }
        requestsUtils.makePostBodyRequest(server.url, path, null, data, done, 200)
      })
    })
  })

  describe('Of the videos API', function () {
    const path = '/api/v1/videos/'

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
          description: 'my super description',
          tags: [ 'tag1', 'tag2' ]
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short.webm')
        }
        requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
      })

      it('Should fail with a long name', function (done) {
        const data = {
          name: 'My very very very very very very very very very very very very very very very very long name',
          description: 'my super description',
          tags: [ 'tag1', 'tag2' ]
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short.webm')
        }
        requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
      })

      it('Should fail without description', function (done) {
        const data = {
          name: 'my super name',
          tags: [ 'tag1', 'tag2' ]
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short.webm')
        }
        requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
      })

      it('Should fail with a long description', function (done) {
        const data = {
          name: 'my super name',
          description: 'my super description which is very very very very very very very very very very very very very very' +
                       'very very very very very very very very very very very very very very very very very very very very very' +
                       'very very very very very very very very very very very very very very very long',
          tags: [ 'tag1', 'tag2' ]
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short.webm')
        }
        requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
      })

      it('Should fail without tags', function (done) {
        const data = {
          name: 'my super name',
          description: 'my super description'
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short.webm')
        }
        requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
      })

      it('Should fail with too many tags', function (done) {
        const data = {
          name: 'my super name',
          description: 'my super description',
          tags: [ 'tag1', 'tag2', 'tag3', 'tag4' ]
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short.webm')
        }
        requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
      })

      it('Should fail with not enough tags', function (done) {
        const data = {
          name: 'my super name',
          description: 'my super description',
          tags: [ ]
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short.webm')
        }
        requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
      })

      it('Should fail with a tag length too low', function (done) {
        const data = {
          name: 'my super name',
          description: 'my super description',
          tags: [ 'tag1', 't' ]
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short.webm')
        }
        requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
      })

      it('Should fail with a tag length too big', function (done) {
        const data = {
          name: 'my super name',
          description: 'my super description',
          tags: [ 'mysupertagtoolong', 'tag1' ]
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short.webm')
        }
        requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
      })

      it('Should fail with malformed tags', function (done) {
        const data = {
          name: 'my super name',
          description: 'my super description',
          tags: [ 'my tag' ]
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short.webm')
        }
        requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
      })

      it('Should fail without an input file', function (done) {
        const data = {
          name: 'my super name',
          description: 'my super description',
          tags: [ 'tag1', 'tag2' ]
        }
        const attach = {}
        requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
      })

      it('Should fail without an incorrect input file', function (done) {
        const data = {
          name: 'my super name',
          description: 'my super description',
          tags: [ 'tag1', 'tag2' ]
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short_fake.webm')
        }
        requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
      })

      it('Should fail with a too big duration', function (done) {
        const data = {
          name: 'my super name',
          description: 'my super description',
          tags: [ 'tag1', 'tag2' ]
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_too_long.webm')
        }
        requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done)
      })

      it('Should succeed with the correct parameters', function (done) {
        const data = {
          name: 'my super name',
          description: 'my super description',
          tags: [ 'tag1', 'tag2' ]
        }
        const attach = {
          'videofile': pathUtils.join(__dirname, 'fixtures', 'video_short.webm')
        }
        requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, function () {
          attach.videofile = pathUtils.join(__dirname, 'fixtures', 'video_short.mp4')
          requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, function () {
            attach.videofile = pathUtils.join(__dirname, 'fixtures', 'video_short.ogv')
            requestsUtils.makePostUploadRequest(server.url, path, server.accessToken, data, attach, done, 204)
          }, false)
        }, false)
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

            expect(res.body.data).to.be.an('array')
            expect(res.body.data.length).to.equal(3)

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
          .get(path + '4da6fde3-88f7-4d16-b119-108df5630b06')
          .set('Accept', 'application/json')
          .expect(404, done)
      })

      it('Should succeed with the correct parameters')
    })

    describe('When removing a video', function () {
      it('Should have 404 with nothing', function (done) {
        request(server.url)
          .delete(path)
          .set('Authorization', 'Bearer ' + server.accessToken)
          .expect(400, done)
      })

      it('Should fail without a mongodb id', function (done) {
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
  })

  describe('Of the users API', function () {
    const path = '/api/v1/users/'
    let userId = null
    let rootId = null

    describe('When listing users', function () {
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

    describe('When adding a new user', function () {
      it('Should fail with a too small username', function (done) {
        const data = {
          username: 'ji',
          password: 'mysuperpassword'
        }

        requestsUtils.makePostBodyRequest(server.url, path, server.accessToken, data, done)
      })

      it('Should fail with a too long username', function (done) {
        const data = {
          username: 'mysuperusernamewhichisverylong',
          password: 'mysuperpassword'
        }

        requestsUtils.makePostBodyRequest(server.url, path, server.accessToken, data, done)
      })

      it('Should fail with an incorrect username', function (done) {
        const data = {
          username: 'my username',
          password: 'mysuperpassword'
        }

        requestsUtils.makePostBodyRequest(server.url, path, server.accessToken, data, done)
      })

      it('Should fail with a too small password', function (done) {
        const data = {
          username: 'myusername',
          password: 'bla'
        }

        requestsUtils.makePostBodyRequest(server.url, path, server.accessToken, data, done)
      })

      it('Should fail with a too long password', function (done) {
        const data = {
          username: 'myusername',
          password: 'my super long password which is very very very very very very very very very very very very very very' +
                    'very very very very very very very very very very very very very very very veryv very very very very' +
                    'very very very very very very very very very very very very very very very very very very very very long'
        }

        requestsUtils.makePostBodyRequest(server.url, path, server.accessToken, data, done)
      })

      it('Should fail with an non authenticated user', function (done) {
        const data = {
          username: 'myusername',
          password: 'my super password'
        }

        requestsUtils.makePostBodyRequest(server.url, path, 'super token', data, done, 401)
      })

      it('Should fail if we add a user with the same username', function (done) {
        const data = {
          username: 'user1',
          password: 'my super password'
        }

        requestsUtils.makePostBodyRequest(server.url, path, server.accessToken, data, done, 409)
      })

      it('Should succeed with the correct params', function (done) {
        const data = {
          username: 'user2',
          password: 'my super password'
        }

        requestsUtils.makePostBodyRequest(server.url, path, server.accessToken, data, done, 204)
      })

      it('Should fail with a non admin user', function (done) {
        server.user = {
          username: 'user1',
          password: 'password'
        }

        loginUtils.loginAndGetAccessToken(server, function (err, accessToken) {
          if (err) throw err

          userAccessToken = accessToken

          const data = {
            username: 'user3',
            password: 'my super password'
          }

          requestsUtils.makePostBodyRequest(server.url, path, userAccessToken, data, done, 403)
        })
      })
    })

    describe('When updating a user', function () {
      before(function (done) {
        usersUtils.getUsersList(server.url, function (err, res) {
          if (err) throw err

          userId = res.body.data[1].id
          rootId = res.body.data[2].id
          done()
        })
      })

      it('Should fail with a too small password', function (done) {
        const data = {
          password: 'bla'
        }

        requestsUtils.makePutBodyRequest(server.url, path + userId, userAccessToken, data, done)
      })

      it('Should fail with a too long password', function (done) {
        const data = {
          password: 'my super long password which is very very very very very very very very very very very very very very' +
                    'very very very very very very very very very very very very very very very veryv very very very very' +
                    'very very very very very very very very very very very very very very very very very very very very long'
        }

        requestsUtils.makePutBodyRequest(server.url, path + userId, userAccessToken, data, done)
      })

      it('Should fail with an non authenticated user', function (done) {
        const data = {
          password: 'my super password'
        }

        requestsUtils.makePutBodyRequest(server.url, path + userId, 'super token', data, done, 401)
      })

      it('Should succeed with the correct params', function (done) {
        const data = {
          password: 'my super password'
        }

        requestsUtils.makePutBodyRequest(server.url, path + userId, userAccessToken, data, done, 204)
      })
    })

    describe('When getting my information', function () {
      it('Should fail with a non authenticated user', function (done) {
        request(server.url)
          .get(path + 'me')
          .set('Authorization', 'Bearer faketoken')
          .set('Accept', 'application/json')
          .expect(401, done)
      })

      it('Should success with the correct parameters', function (done) {
        request(server.url)
          .get(path + 'me')
          .set('Authorization', 'Bearer ' + userAccessToken)
          .set('Accept', 'application/json')
          .expect(200, done)
      })
    })

    describe('When removing an user', function () {
      it('Should fail with an incorrect id', function (done) {
        request(server.url)
          .delete(path + 'bla-bla')
          .set('Authorization', 'Bearer ' + server.accessToken)
          .expect(400, done)
      })

      it('Should fail with the root user', function (done) {
        request(server.url)
          .delete(path + rootId)
          .set('Authorization', 'Bearer ' + server.accessToken)
          .expect(400, done)
      })

      it('Should return 404 with a non existing id', function (done) {
        request(server.url)
          .delete(path + '45')
          .set('Authorization', 'Bearer ' + server.accessToken)
          .expect(404, done)
      })
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

  describe('Of the requests API', function () {
    const path = '/api/v1/requests/stats'

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
