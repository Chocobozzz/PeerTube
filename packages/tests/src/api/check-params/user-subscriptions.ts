/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  cleanupTests,
  createSingleServer,
  makeDeleteRequest,
  makeGetRequest,
  makePostBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { HttpStatusCode } from '@peertube/peertube-models'
import { checkBadStartPagination, checkBadCountPagination, checkBadSort } from '@tests/shared/checks.js'

describe('Test user subscriptions API validators', function () {
  const path = '/api/v1/users/me/subscriptions'
  let server: PeerTubeServer
  let userAccessToken = ''

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    const user = {
      username: 'user1',
      password: 'my super password'
    }
    await server.users.create({ username: user.username, password: user.password })
    userAccessToken = await server.login.getAccessToken(user)
  })

  describe('When listing my subscriptions', function () {
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

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('When listing my subscriptions videos', function () {
    const path = '/api/v1/users/me/subscriptions/videos'

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

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('When adding a subscription', function () {
    it('Should fail with a non authenticated user', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: { uri: 'user1_channel@' + server.host },
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with bad URIs', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: { uri: 'root' },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: { uri: 'root@' },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: { uri: 'root@hello@' },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with the correct parameters', async function () {
      this.timeout(20000)

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: { uri: 'user1_channel@' + server.host },
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })

      await waitJobs([ server ])
    })
  })

  describe('When getting a subscription', function () {
    it('Should fail with a non authenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path: path + '/user1_channel@' + server.host,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with bad URIs', async function () {
      await makeGetRequest({
        url: server.url,
        path: path + '/root',
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await makeGetRequest({
        url: server.url,
        path: path + '/root@',
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await makeGetRequest({
        url: server.url,
        path: path + '/root@hello@',
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with an unknown subscription', async function () {
      await makeGetRequest({
        url: server.url,
        path: path + '/root1@' + server.host,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path: path + '/user1_channel@' + server.host,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('When checking if subscriptions exist', function () {
    const existPath = path + '/exist'

    it('Should fail with a non authenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path: existPath,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with bad URIs', async function () {
      await makeGetRequest({
        url: server.url,
        path: existPath,
        query: { uris: 'toto' },
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await makeGetRequest({
        url: server.url,
        path: existPath,
        query: { 'uris[]': 1 },
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path: existPath,
        query: { 'uris[]': 'coucou@' + server.host },
        token: server.accessToken,
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('When removing a subscription', function () {
    it('Should fail with a non authenticated user', async function () {
      await makeDeleteRequest({
        url: server.url,
        path: path + '/user1_channel@' + server.host,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with bad URIs', async function () {
      await makeDeleteRequest({
        url: server.url,
        path: path + '/root',
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await makeDeleteRequest({
        url: server.url,
        path: path + '/root@',
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await makeDeleteRequest({
        url: server.url,
        path: path + '/root@hello@',
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with an unknown subscription', async function () {
      await makeDeleteRequest({
        url: server.url,
        path: path + '/root1@' + server.host,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeDeleteRequest({
        url: server.url,
        path: path + '/user1_channel@' + server.host,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
