/* tslint:disable:no-unused-expression */

import 'mocha'

import {
  createUser,
  flushTests,
  killallServers,
  runServer,
  ServerInfo,
  setAccessTokensToServers,
  userLogin
} from '../../../../shared/utils'
import { makeGetRequest } from '../../../../shared/utils/requests/requests'

describe('Test logs API validators', function () {
  const path = '/api/v1/server/logs'
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
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
