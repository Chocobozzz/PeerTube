/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, User, UserRole } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { checkBadCountPagination, checkBadSort, checkBadStartPagination } from '@tests/shared/checks.js'

describe('Test token session API validators', function () {
  let server: PeerTubeServer
  let userToken1: string
  let userToken2: string
  let moderatorToken: string
  let moderatorToken2: string
  let user1: User
  let rootId: number
  let moderator2Id: number
  let path: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    {
      server = await createSingleServer(1)
      await setAccessTokensToServers([ server ])
    }

    userToken1 = await server.users.generateUserAndToken('user1')
    userToken2 = await server.users.generateUserAndToken('user2')
    moderatorToken = await server.users.generateUserAndToken('moderator1', UserRole.MODERATOR)
    moderatorToken2 = await server.users.generateUserAndToken('moderator2', UserRole.MODERATOR)

    user1 = await server.users.getMyInfo({ token: userToken1 })
    const root = await server.users.getMyInfo()
    rootId = root.id

    const moderator2 = await server.users.getMyInfo({ token: moderatorToken2 })
    moderator2Id = moderator2.id

    path = `/api/v1/users/${user1.id}/token-sessions`
  })

  describe('When listing token sessions', function () {
    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, userToken1)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, userToken1)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSort(server.url, path, userToken1)
    })

    it('Should fail with an unknown user', async function () {
      await makeGetRequest({
        url: server.url,
        path: `/api/v1/users/999999999/token-sessions`,
        token: userToken1,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail without a token', async function () {
      await makeGetRequest({ url: server.url, path, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with the token of another user', async function () {
      await makeGetRequest({ url: server.url, path, token: userToken2, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path, token: userToken1, expectedStatus: HttpStatusCode.OK_200 })
    })

    it('Should fail to list token sessions of an administrator with a moderator', async function () {
      await makeGetRequest({
        url: server.url,
        path: `/api/v1/users/${rootId}/token-sessions`,
        token: moderatorToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed to list token sessions of a regular user with a moderator', async function () {
      await makeGetRequest({ url: server.url, path, token: moderatorToken, expectedStatus: HttpStatusCode.OK_200 })
    })

    it('Should fail to list token sessions of another moderator with a moderator', async function () {
      await makeGetRequest({
        url: server.url,
        path: `/api/v1/users/${moderator2Id}/token-sessions`,
        token: moderatorToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })
  })

  describe('When revoking a token session', function () {
    let sessionId: number

    before(async function () {
      const response = await server.login.listSessions({ userId: user1.id, token: userToken1 })
      sessionId = response.data[0].id
    })

    it('Should fail without a token', async function () {
      await server.login.revokeSession({ userId: user1.id, sessionId, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with the token of another user', async function () {
      await server.login.revokeSession({ userId: user1.id, sessionId, token: userToken2, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with an unknown session', async function () {
      await server.login.revokeSession({
        userId: user1.id,
        sessionId: 999999999,
        token: userToken1,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with an unknown user', async function () {
      await server.login.revokeSession({ userId: 999999999, sessionId, token: userToken1, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with the session of another user', async function () {
      const user2 = await server.users.getMyInfo({ token: userToken2 })

      await server.login.revokeSession({ userId: user2.id, sessionId, token: userToken2, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path, token: userToken1, expectedStatus: HttpStatusCode.OK_200 })
    })

    it('Should fail to revoke a token session of an administrator with a moderator', async function () {
      const { data } = await server.login.listSessions({ userId: rootId })
      const rootSessionId = data[0].id

      await server.login.revokeSession({
        userId: rootId,
        sessionId: rootSessionId,
        token: moderatorToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail to revoke a token session of another moderator with a moderator', async function () {
      const { data } = await server.login.listSessions({ userId: moderator2Id, token: moderatorToken2 })
      const moderator2SessionId = data[0].id

      await server.login.revokeSession({
        userId: moderator2Id,
        sessionId: moderator2SessionId,
        token: moderatorToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
