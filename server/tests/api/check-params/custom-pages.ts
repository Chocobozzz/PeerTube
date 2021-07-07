/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'
import {
  cleanupTests,
  createUser,
  flushAndRunServer,
  ServerInfo,
  setAccessTokensToServers,
  userLogin
} from '../../../../shared/extra-utils'
import { makeGetRequest, makePutBodyRequest } from '../../../../shared/extra-utils/requests/requests'

describe('Test custom pages validators', function () {
  const path = '/api/v1/custom-pages/homepage/instance'

  let server: ServerInfo
  let userAccessToken: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    const user = { username: 'user1', password: 'password' }
    await createUser({ url: server.url, accessToken: server.accessToken, username: user.username, password: user.password })

    userAccessToken = await userLogin(server, user)
  })

  describe('When updating instance homepage', function () {

    it('Should fail with an unauthenticated user', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        fields: { content: 'super content' },
        statusCodeExpected: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non admin user', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        token: userAccessToken,
        fields: { content: 'super content' },
        statusCodeExpected: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with the correct params', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: { content: 'super content' },
        statusCodeExpected: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When getting instance homapage', function () {

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        statusCodeExpected: HttpStatusCode.OK_200
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
