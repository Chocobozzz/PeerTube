/* tslint:disable:no-unused-expression */

import * as request from 'supertest'
import 'mocha'

import {
  flushTests,
  runServer,
  createUser,
  setAccessTokensToServers,
  killallServers,
  getUserAccessToken
} from '../../utils'

describe('Test request schedulers stats API validators', function () {
  const path = '/api/v1/request-schedulers/stats'
  let server = null
  let userAccessToken = null

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    await flushTests()

    server = await runServer(1)
    await setAccessTokensToServers([ server ])

    const username = 'user'
    const password = 'my super password'
    await createUser(server.url, server.accessToken, username, password)

    const user = {
      username: 'user',
      password: 'my super password'
    }

    userAccessToken = await getUserAccessToken(server, user)
  })

  it('Should fail with an non authenticated user', async function () {
    await request(server.url)
            .get(path)
            .set('Accept', 'application/json')
            .expect(401)
  })

  it('Should fail with a non admin user', async function () {
    await request(server.url)
            .get(path)
            .set('Authorization', 'Bearer ' + userAccessToken)
            .set('Accept', 'application/json')
            .expect(403)
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
