/* tslint:disable:no-unused-expression */

import 'mocha'
import * as request from 'supertest'

import { createUser, flushTests, userLogin, killallServers, runServer, ServerInfo, setAccessTokensToServers } from '../../utils'

describe('Test jobs API validators', function () {
  const path = '/api/v1/jobs/'
  let server: ServerInfo
  let userAccessToken = ''

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])

    const user = {
      username: 'user1',
      password: 'my super password'
    }
    await createUser(server.url, server.accessToken, user.username, user.password)
    userAccessToken = await userLogin(server, user)
  })

  describe('When listing jobs', function () {
    it('Should fail with a bad start pagination', async function () {
      await request(server.url)
              .get(path)
              .query({ start: 'hello' })
              .set('Accept', 'application/json')
              .set('Authorization', 'Bearer ' + server.accessToken)
              .expect(400)
    })

    it('Should fail with a bad count pagination', async function () {
      await request(server.url)
              .get(path)
              .query({ count: 'hello' })
              .set('Accept', 'application/json')
              .set('Authorization', 'Bearer ' + server.accessToken)
              .expect(400)
    })

    it('Should fail with an incorrect sort', async function () {
      await request(server.url)
              .get(path)
              .query({ sort: 'hello' })
              .set('Accept', 'application/json')
              .set('Authorization', 'Bearer ' + server.accessToken)
              .expect(400)
    })

    it('Should fail with a non authenticated user', async function () {
      await request(server.url)
        .get(path)
        .set('Accept', 'application/json')
        .expect(401)
    })

    it('Should fail with a non admin user', async function () {
      await request(server.url)
        .get(path)
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer ' + userAccessToken)
        .expect(403)
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
