'use strict'

const request = require('supertest')
const series = require('async/series')

const loginUtils = require('../../utils/login')
const requestsUtils = require('../../utils/requests')
const serversUtils = require('../../utils/servers')
const usersUtils = require('../../utils/users')

describe('Test pods API validators', function () {
  const path = '/api/v1/pods/'
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
