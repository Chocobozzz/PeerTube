/* tslint:disable:no-unused-expression */

import 'mocha'

import {
  createUser,
  flushTests,
  killallServers,
  makeDeleteRequest,
  makeGetRequest,
  makePostBodyRequest,
  runServer,
  ServerInfo,
  setAccessTokensToServers,
  userLogin
} from '../../utils'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '../../utils/requests/check-api-params'

describe('Test user subscriptions API validators', function () {
  const path = '/api/v1/users/me/subscriptions'
  let server: ServerInfo
  let userAccessToken = ''

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

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

  describe('When listing my subscriptions', function () {
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
        statusCodeExpected: 401
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: userAccessToken,
        statusCodeExpected: 200
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
      await checkBadSortPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a non authenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        statusCodeExpected: 401
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: userAccessToken,
        statusCodeExpected: 200
      })
    })
  })

  describe('When adding a subscription', function () {
    it('Should fail with a non authenticated user', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: { uri: 'user1_channel@localhost:9001' },
        statusCodeExpected: 401
      })
    })

    it('Should fail with bad URIs', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: { uri: 'root' },
        statusCodeExpected: 400
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: { uri: 'root@' },
        statusCodeExpected: 400
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: { uri: 'root@hello@' },
        statusCodeExpected: 400
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: { uri: 'user1_channel@localhost:9001' },
        statusCodeExpected: 204
      })
    })
  })

  describe('When getting a subscription', function () {
    it('Should fail with a non authenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path: path + '/user1_channel@localhost:9001',
        statusCodeExpected: 401
      })
    })

    it('Should fail with bad URIs', async function () {
      await makeGetRequest({
        url: server.url,
        path: path + '/root',
        token: server.accessToken,
        statusCodeExpected: 400
      })

      await makeGetRequest({
        url: server.url,
        path: path + '/root@',
        token: server.accessToken,
        statusCodeExpected: 400
      })

      await makeGetRequest({
        url: server.url,
        path: path + '/root@hello@',
        token: server.accessToken,
        statusCodeExpected: 400
      })
    })

    it('Should fail with an unknown subscription', async function () {
      await makeGetRequest({
        url: server.url,
        path: path + '/root1@localhost:9001',
        token: server.accessToken,
        statusCodeExpected: 404
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path: path + '/user1_channel@localhost:9001',
        token: server.accessToken,
        statusCodeExpected: 200
      })
    })
  })

  describe('When checking if subscriptions exist', async function () {
    const existPath = path + '/exist'

    it('Should fail with a non authenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path: existPath,
        statusCodeExpected: 401
      })
    })

    it('Should fail with bad URIs', async function () {
      await makeGetRequest({
        url: server.url,
        path: existPath,
        query: { uris: 'toto' },
        token: server.accessToken,
        statusCodeExpected: 400
      })

      await makeGetRequest({
        url: server.url,
        path: existPath,
        query: { 'uris[]': 1 },
        token: server.accessToken,
        statusCodeExpected: 400
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path: existPath,
        query: { 'uris[]': 'coucou@localhost:9001' },
        token: server.accessToken,
        statusCodeExpected: 200
      })
    })
  })

  describe('When removing a subscription', function () {
    it('Should fail with a non authenticated user', async function () {
      await makeDeleteRequest({
        url: server.url,
        path: path + '/user1_channel@localhost:9001',
        statusCodeExpected: 401
      })
    })

    it('Should fail with bad URIs', async function () {
      await makeDeleteRequest({
        url: server.url,
        path: path + '/root',
        token: server.accessToken,
        statusCodeExpected: 400
      })

      await makeDeleteRequest({
        url: server.url,
        path: path + '/root@',
        token: server.accessToken,
        statusCodeExpected: 400
      })

      await makeDeleteRequest({
        url: server.url,
        path: path + '/root@hello@',
        token: server.accessToken,
        statusCodeExpected: 400
      })
    })

    it('Should fail with an unknown subscription', async function () {
      await makeDeleteRequest({
        url: server.url,
        path: path + '/root1@localhost:9001',
        token: server.accessToken,
        statusCodeExpected: 404
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeDeleteRequest({
        url: server.url,
        path: path + '/user1_channel@localhost:9001',
        token: server.accessToken,
        statusCodeExpected: 204
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
