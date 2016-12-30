'use strict'

const request = require('supertest')
const series = require('async/series')

const loginUtils = require('../../utils/login')
const requestsUtils = require('../../utils/requests')
const serversUtils = require('../../utils/servers')
const usersUtils = require('../../utils/users')

describe('Test users API validators', function () {
  const path = '/api/v1/users/'
  let userId = null
  let rootId = null
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
      }
    ], done)
  })

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
        password: 'my super password'
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
