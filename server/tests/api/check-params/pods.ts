/* tslint:disable:no-unused-expression */

import * as request from 'supertest'
import 'mocha'

import {
  ServerInfo,
  flushTests,
  runServer,
  createUser,
  loginAndGetAccessToken,
  setAccessTokensToServers,
  killallServers,
  makePostBodyRequest
} from '../../utils'

describe('Test pods API validators', function () {
  const path = '/api/v1/pods/'
  let server: ServerInfo

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(45000)

    await flushTests()
    server = await runServer(1)

    await setAccessTokensToServers([ server ])
  })

  describe('When managing friends', function () {
    let userAccessToken = null

    before(async function () {
      await createUser(server.url, server.accessToken, 'user1', 'password')
      server.user = {
        username: 'user1',
        password: 'password'
      }

      userAccessToken = await loginAndGetAccessToken(server)
    })

    describe('When making friends', function () {
      const body = {
        hosts: [ 'localhost:9002' ]
      }

      it('Should fail without hosts', async function () {
        await request(server.url)
                .post(path + '/makefriends')
                .set('Authorization', 'Bearer ' + server.accessToken)
                .set('Accept', 'application/json')
                .expect(400)
      })

      it('Should fail if hosts is not an array', async function () {
        await request(server.url)
                .post(path + '/makefriends')
                .send({ hosts: 'localhost:9002' })
                .set('Authorization', 'Bearer ' + server.accessToken)
                .set('Accept', 'application/json')
                .expect(400)
      })

      it('Should fail if the array is not composed by hosts', async function () {
        await request(server.url)
                .post(path + '/makefriends')
                .send({ hosts: [ 'localhost:9002', 'localhost:coucou' ] })
                .set('Authorization', 'Bearer ' + server.accessToken)
                .set('Accept', 'application/json')
                .expect(400)
      })

      it('Should fail if the array is composed with http schemes', async function () {
        await request(server.url)
                .post(path + '/makefriends')
                .send({ hosts: [ 'localhost:9002', 'http://localhost:9003' ] })
                .set('Authorization', 'Bearer ' + server.accessToken)
                .set('Accept', 'application/json')
                .expect(400)
      })

      it('Should fail if hosts are not unique', async function () {
        await request(server.url)
                .post(path + '/makefriends')
                .send({ urls: [ 'localhost:9002', 'localhost:9002' ] })
                .set('Authorization', 'Bearer ' + server.accessToken)
                .set('Accept', 'application/json')
                .expect(400)
      })

      it('Should fail with an invalid token', async function () {
        await request(server.url)
                .post(path + '/makefriends')
                .send(body)
                .set('Authorization', 'Bearer faketoken')
                .set('Accept', 'application/json')
                .expect(401)
      })

      it('Should fail if the user is not an administrator', async function () {
        await request(server.url)
                .post(path + '/makefriends')
                .send(body)
                .set('Authorization', 'Bearer ' + userAccessToken)
                .set('Accept', 'application/json')
                .expect(403)
      })
    })

    describe('When quitting friends', function () {
      it('Should fail with an invalid token', async function () {
        await request(server.url)
                .get(path + '/quitfriends')
                .query({ start: 'hello' })
                .set('Authorization', 'Bearer faketoken')
                .set('Accept', 'application/json')
                .expect(401)
      })

      it('Should fail if the user is not an administrator', async function () {
        await request(server.url)
                .get(path + '/quitfriends')
                .query({ start: 'hello' })
                .set('Authorization', 'Bearer ' + userAccessToken)
                .set('Accept', 'application/json')
                .expect(403)
      })
    })

    describe('When removing one friend', function () {
      it('Should fail with an invalid token', async function () {
      	await request(server.url)
                .delete(path + '/1')
                .set('Authorization', 'Bearer faketoken')
                .set('Accept', 'application/json')
                .expect(401)
      })

      it('Should fail if the user is not an administrator', async function () {
      	await request(server.url)
                .delete(path + '/1')
                .set('Authorization', 'Bearer ' + userAccessToken)
                .set('Accept', 'application/json')
                .expect(403)
      })

      it('Should fail with an undefined id', async function () {
        await request(server.url)
                .delete(path + '/' + undefined)
                .set('Authorization', 'Bearer ' + server.accessToken)
                .set('Accept', 'application/json')
                .expect(400)
      })

      it('Should fail with an invalid id', async function () {
	      await request(server.url)
                .delete(path + '/foobar')
                .set('Authorization', 'Bearer ' + server.accessToken)
                .set('Accept', 'application/json')
                .expect(400)
      })

      it('Should fail if the pod is not a friend', async function () {
	      await request(server.url)
                .delete(path + '/-1')
                .set('Authorization', 'Bearer ' + server.accessToken)
                .set('Accept', 'application/json')
                .expect(404)
      })

      it('Should succeed with the correct parameters')
    })
  })

  describe('When adding a pod', function () {
    it('Should fail with nothing', async function () {
      const fields = {}
      await makePostBodyRequest({ url: server.url, path, fields })
    })

    it('Should fail without public key', async function () {
      const fields = {
        email: 'test.example.com',
        host: 'coucou.com'
      }
      await makePostBodyRequest({ url: server.url, path, fields })
    })

    it('Should fail without an email', async function () {
      const fields = {
        host: 'coucou.com',
        publicKey: 'my super public key'
      }
      await makePostBodyRequest({ url: server.url, path, fields })
    })

    it('Should fail without an invalid email', async function () {
      const fields = {
        host: 'coucou.com',
        email: 'test.example.com',
        publicKey: 'my super public key'
      }
      await makePostBodyRequest({ url: server.url, path, fields })
    })

    it('Should fail without a host', async function () {
      const fields = {
        email: 'test.example.com',
        publicKey: 'my super public key'
      }
      await makePostBodyRequest({ url: server.url, path, fields })
    })

    it('Should fail with an incorrect host', async function () {
      const fields = {
        host: 'http://coucou.com',
        email: 'test.example.com',
        publicKey: 'my super public key'
      }
      await makePostBodyRequest({ url: server.url, path, fields })

      fields.host = 'http://coucou'
      await makePostBodyRequest({ url: server.url, path, fields })

      fields.host = 'coucou'
      await makePostBodyRequest({ url: server.url, path, fields })
    })

    it('Should succeed with the correct parameters', async function () {
      const fields = {
        host: 'coucou.com',
        email: 'test@example.com',
        publicKey: 'my super public key'
      }
      await makePostBodyRequest({ url: server.url, path, fields, statusCodeExpected: 200 })
    })

    it('Should fail with a host that already exists', async function () {
      const fields = {
        host: 'coucou.com',
        email: 'test@example.com',
        publicKey: 'my super public key'
      }
      await makePostBodyRequest({ url: server.url, path, fields, statusCodeExpected: 409 })
    })
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
