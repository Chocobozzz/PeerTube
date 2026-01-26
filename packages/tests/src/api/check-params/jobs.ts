/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { checkBadCountPagination, checkBadSort, checkBadStartPagination } from '@tests/shared/checks.js'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  makePostBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

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
      await checkBadSort(server.url, path, server.accessToken)
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

  describe('When pausing/resuming the job queue', async function () {
    const commands = [ 'pause', 'resume' ]

    it('Should fail with a non authenticated user', async function () {
      for (const command of commands) {
        await makePostBodyRequest({
          url: server.url,
          path: '/api/v1/jobs/' + command,
          expectedStatus: HttpStatusCode.UNAUTHORIZED_401
        })
      }
    })

    it('Should fail with a non admin user', async function () {
      for (const command of commands) {
        await makePostBodyRequest({
          url: server.url,
          path: '/api/v1/jobs/' + command,
          expectedStatus: HttpStatusCode.UNAUTHORIZED_401
        })
      }
    })

    it('Should succeed with the correct params', async function () {
      for (const command of commands) {
        await makePostBodyRequest({
          url: server.url,
          path: '/api/v1/jobs/' + command,
          token: server.accessToken,
          expectedStatus: HttpStatusCode.NO_CONTENT_204
        })
      }
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
