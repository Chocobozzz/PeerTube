/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'

import {
  cleanupTests,
  flushAndRunServer,
  ServerInfo,
  setAccessTokensToServers
} from '../../../../shared/extra-utils'
import { makeGetRequest } from '../../../../shared/extra-utils/requests/requests'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'

describe('Test debug API validators', function () {
  const path = '/api/v1/server/debug'
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
    await server.usersCommand.create({ username: user.username, password: user.password })
    userAccessToken = await server.loginCommand.getAccessToken(user)
  })

  describe('When getting debug endpoint', function () {

    it('Should fail with a non authenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        statusCodeExpected: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non admin user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: userAccessToken,
        statusCodeExpected: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        query: { startDate: new Date().toISOString() },
        statusCodeExpected: HttpStatusCode.OK_200
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
