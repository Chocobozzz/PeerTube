/* tslint:disable:no-unused-expression */

import 'mocha'
import * as request from 'supertest'

import {
  createUser,
  flushTests,
  killallServers,
  loginAndGetAccessToken,
  runServer,
  ServerInfo,
  setAccessTokensToServers
} from '../../utils'

describe('Test server follows API validators', function () {
  let server: ServerInfo

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(45000)

    await flushTests()
    server = await runServer(1)

    await setAccessTokensToServers([ server ])
  })

  describe('When managing following', function () {
    let userAccessToken = null

    before(async function () {
      await createUser(server.url, server.accessToken, 'user1', 'password')
      server.user = {
        username: 'user1',
        password: 'password'
      }

      userAccessToken = await loginAndGetAccessToken(server)
    })

    describe('When adding follows', function () {
      const path = '/api/v1/server/following'
      const body = {
        hosts: [ 'localhost:9002' ]
      }

      it('Should fail without hosts', async function () {
        await request(server.url)
                .post(path)
                .set('Authorization', 'Bearer ' + server.accessToken)
                .set('Accept', 'application/json')
                .expect(400)
      })

      it('Should fail if hosts is not an array', async function () {
        await request(server.url)
                .post(path)
                .send({ hosts: 'localhost:9002' })
                .set('Authorization', 'Bearer ' + server.accessToken)
                .set('Accept', 'application/json')
                .expect(400)
      })

      it('Should fail if the array is not composed by hosts', async function () {
        await request(server.url)
                .post(path)
                .send({ hosts: [ 'localhost:9002', 'localhost:coucou' ] })
                .set('Authorization', 'Bearer ' + server.accessToken)
                .set('Accept', 'application/json')
                .expect(400)
      })

      it('Should fail if the array is composed with http schemes', async function () {
        await request(server.url)
                .post(path)
                .send({ hosts: [ 'localhost:9002', 'http://localhost:9003' ] })
                .set('Authorization', 'Bearer ' + server.accessToken)
                .set('Accept', 'application/json')
                .expect(400)
      })

      it('Should fail if hosts are not unique', async function () {
        await request(server.url)
                .post(path)
                .send({ urls: [ 'localhost:9002', 'localhost:9002' ] })
                .set('Authorization', 'Bearer ' + server.accessToken)
                .set('Accept', 'application/json')
                .expect(400)
      })

      it('Should fail with an invalid token', async function () {
        await request(server.url)
                .post(path)
                .send(body)
                .set('Authorization', 'Bearer fake_token')
                .set('Accept', 'application/json')
                .expect(401)
      })

      it('Should fail if the user is not an administrator', async function () {
        await request(server.url)
                .post(path)
                .send(body)
                .set('Authorization', 'Bearer ' + userAccessToken)
                .set('Accept', 'application/json')
                .expect(403)
      })
    })

    describe('When listing followings', function () {
      const path = '/api/v1/server/following'

      it('Should fail with a bad start pagination', async function () {
        await request(server.url)
          .get(path)
          .query({ start: 'hello' })
          .set('Accept', 'application/json')
          .expect(400)
      })

      it('Should fail with a bad count pagination', async function () {
        await request(server.url)
          .get(path)
          .query({ count: 'hello' })
          .set('Accept', 'application/json')
          .expect(400)
      })

      it('Should fail with an incorrect sort', async function () {
        await request(server.url)
          .get(path)
          .query({ sort: 'hello' })
          .set('Accept', 'application/json')
          .expect(400)
      })
    })

    describe('When listing followers', function () {
      const path = '/api/v1/server/followers'

      it('Should fail with a bad start pagination', async function () {
        await request(server.url)
          .get(path)
          .query({ start: 'hello' })
          .set('Accept', 'application/json')
          .expect(400)
      })

      it('Should fail with a bad count pagination', async function () {
        await request(server.url)
          .get(path)
          .query({ count: 'hello' })
          .set('Accept', 'application/json')
          .expect(400)
      })

      it('Should fail with an incorrect sort', async function () {
        await request(server.url)
          .get(path)
          .query({ sort: 'hello' })
          .set('Accept', 'application/json')
          .expect(400)
      })
    })

    describe('When removing following', function () {
      const path = '/api/v1/server/following'

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

      it('Should fail we do not follow this server', async function () {
	      await request(server.url)
                .delete(path + '/example.com')
                .set('Authorization', 'Bearer ' + server.accessToken)
                .set('Accept', 'application/json')
                .expect(404)
      })

      it('Should succeed with the correct parameters')
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
