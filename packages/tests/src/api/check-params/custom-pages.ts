/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  makePutBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

describe('Test custom pages validators', function () {
  const path = '/api/v1/custom-pages/homepage/instance'

  let server: PeerTubeServer
  let userAccessToken: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    const user = { username: 'user1', password: 'password' }
    await server.users.create({ username: user.username, password: user.password })

    userAccessToken = await server.login.getAccessToken(user)
  })

  describe('When updating instance homepage', function () {

    it('Should fail with an unauthenticated user', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        fields: { content: 'super content' },
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non admin user', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        token: userAccessToken,
        fields: { content: 'super content' },
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with the correct params', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: { content: 'super content' },
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When getting instance homapage', function () {

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
