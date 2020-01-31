/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'

import {
  cleanupTests,
  createUser,
  flushAndRunServer,
  ServerInfo,
  setAccessTokensToServers,
  userLogin
} from '../../../../shared/extra-utils'
import { makeGetRequest } from '../../../../shared/extra-utils/requests/requests'

describe('Test logs API validators', function () {
  const path = '/api/v1/server/logs'
  let server: ServerInfo
  let userAccessToken = ''

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    const user = {
      username: 'user1',
      password: 'my super password'
    }
    await createUser({ url: server.url, accessToken: server.accessToken, username: user.username, password: user.password })
    userAccessToken = await userLogin(server, user)
  })

  describe('When getting logs', function () {

    it('Should fail with a non authenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        statusCodeExpected: 401
      })
    })

    it('Should fail with a non admin user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: userAccessToken,
        statusCodeExpected: 403
      })
    })

    it('Should fail with a missing startDate query', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        statusCodeExpected: 400
      })
    })

    it('Should fail with a bad startDate query', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        query: { startDate: 'toto' },
        statusCodeExpected: 400
      })
    })

    it('Should fail with a bad endDate query', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        query: { startDate: new Date().toISOString(), endDate: 'toto' },
        statusCodeExpected: 400
      })
    })

    it('Should fail with a bad level parameter', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        query: { startDate: new Date().toISOString(), level: 'toto' },
        statusCodeExpected: 400
      })
    })

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        query: { startDate: new Date().toISOString() },
        statusCodeExpected: 200
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
