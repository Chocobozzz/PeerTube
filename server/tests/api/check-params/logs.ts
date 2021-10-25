/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { cleanupTests, createSingleServer, makeGetRequest, PeerTubeServer, setAccessTokensToServers } from '@shared/extra-utils'
import { HttpStatusCode } from '@shared/models'

describe('Test logs API validators', function () {
  const path = '/api/v1/server/logs'
  let server: PeerTubeServer
  let userAccessToken = ''

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    const user = {
      username: 'user1',
      password: 'my super password'
    }
    await server.users.create({ username: user.username, password: user.password })
    userAccessToken = await server.login.getAccessToken(user)
  })

  describe('When getting logs', function () {

    it('Should fail with a non authenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non admin user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with a missing startDate query', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a bad startDate query', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        query: { startDate: 'toto' },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a bad endDate query', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        query: { startDate: new Date().toISOString(), endDate: 'toto' },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a bad level parameter', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        query: { startDate: new Date().toISOString(), level: 'toto' },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        query: { startDate: new Date().toISOString() },
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
