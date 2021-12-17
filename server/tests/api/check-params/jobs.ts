/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '@server/tests/shared'
import { HttpStatusCode } from '@shared/models'
import { cleanupTests, createSingleServer, makeGetRequest, PeerTubeServer, setAccessTokensToServers } from '@shared/server-commands'

describe('Test jobs API validators', function () {
  const path = '/api/v1/jobs/failed'
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

  describe('When listing jobs', function () {

    it('Should fail with a bad state', async function () {
      await makeGetRequest({
        url: server.url,
        token: server.accessToken,
        path: path + 'ade'
      })
    })

    it('Should fail with an incorrect job type', async function () {
      await makeGetRequest({
        url: server.url,
        token: server.accessToken,
        path,
        query: {
          jobType: 'toto'
        }
      })
    })

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, server.accessToken)
    })

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

  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
