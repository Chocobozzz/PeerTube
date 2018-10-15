/* tslint:disable:no-unused-expression */

import 'mocha'

import {
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  flushTests,
  killallServers,
  makeDeleteRequest,
  makeGetRequest,
  makePostBodyRequest,
  ServerInfo,
  setAccessTokensToServers, userLogin
} from '../../utils'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '../../utils/requests/check-api-params'

describe('Test blocklist API validators', function () {
  let servers: ServerInfo[]
  let server: ServerInfo
  let userAccessToken: string

  before(async function () {
    this.timeout(60000)

    await flushTests()

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    server = servers[0]

    const user = { username: 'user1', password: 'password' }
    await createUser(server.url, server.accessToken, user.username, user.password)

    userAccessToken = await userLogin(server, user)

    await doubleFollow(servers[0], servers[1])
  })

  // ---------------------------------------------------------------

  describe('When managing user blocklist', function () {

    describe('When managing user accounts blocklist', function () {
      const path = '/api/v1/users/me/blocklist/accounts'

      describe('When listing blocked accounts', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makeGetRequest({
            url: server.url,
            path,
            statusCodeExpected: 401
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
      })

      describe('When blocking an account', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makePostBodyRequest({
            url: server.url,
            path,
            fields: { accountName: 'user1' },
            statusCodeExpected: 401
          })
        })

        it('Should fail with an unknown account', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { accountName: 'user2' },
            statusCodeExpected: 404
          })
        })

        it('Should fail to block ourselves', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { accountName: 'root' },
            statusCodeExpected: 409
          })
        })

        it('Should succeed with the correct params', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { accountName: 'user1' },
            statusCodeExpected: 204
          })
        })
      })

      describe('When unblocking an account', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/user1',
            statusCodeExpected: 401
          })
        })

        it('Should fail with an unknown account block', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/user2',
            token: server.accessToken,
            statusCodeExpected: 404
          })
        })

        it('Should succeed with the correct params', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/user1',
            token: server.accessToken,
            statusCodeExpected: 204
          })
        })
      })
    })

    describe('When managing user servers blocklist', function () {
      const path = '/api/v1/users/me/blocklist/servers'

      describe('When listing blocked servers', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makeGetRequest({
            url: server.url,
            path,
            statusCodeExpected: 401
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
      })

      describe('When blocking a server', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makePostBodyRequest({
            url: server.url,
            path,
            fields: { host: 'localhost:9002' },
            statusCodeExpected: 401
          })
        })

        it('Should fail with an unknown server', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { host: 'localhost:9003' },
            statusCodeExpected: 404
          })
        })

        it('Should fail with our own server', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { host: 'localhost:9001' },
            statusCodeExpected: 409
          })
        })

        it('Should succeed with the correct params', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { host: 'localhost:9002' },
            statusCodeExpected: 204
          })
        })
      })

      describe('When unblocking a server', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/localhost:9002',
            statusCodeExpected: 401
          })
        })

        it('Should fail with an unknown server block', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/localhost:9003',
            token: server.accessToken,
            statusCodeExpected: 404
          })
        })

        it('Should succeed with the correct params', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/localhost:9002',
            token: server.accessToken,
            statusCodeExpected: 204
          })
        })
      })
    })
  })

  describe('When managing server blocklist', function () {

    describe('When managing server accounts blocklist', function () {
      const path = '/api/v1/server/blocklist/accounts'

      describe('When listing blocked accounts', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makeGetRequest({
            url: server.url,
            path,
            statusCodeExpected: 401
          })
        })

        it('Should fail with a user without the appropriate rights', async function () {
          await makeGetRequest({
            url: server.url,
            token: userAccessToken,
            path,
            statusCodeExpected: 403
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
      })

      describe('When blocking an account', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makePostBodyRequest({
            url: server.url,
            path,
            fields: { accountName: 'user1' },
            statusCodeExpected: 401
          })
        })

        it('Should fail with a user without the appropriate rights', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: userAccessToken,
            path,
            fields: { accountName: 'user1' },
            statusCodeExpected: 403
          })
        })

        it('Should fail with an unknown account', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { accountName: 'user2' },
            statusCodeExpected: 404
          })
        })

        it('Should fail to block ourselves', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { accountName: 'root' },
            statusCodeExpected: 409
          })
        })

        it('Should succeed with the correct params', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { accountName: 'user1' },
            statusCodeExpected: 204
          })
        })
      })

      describe('When unblocking an account', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/user1',
            statusCodeExpected: 401
          })
        })

        it('Should fail with a user without the appropriate rights', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/user1',
            token: userAccessToken,
            statusCodeExpected: 403
          })
        })

        it('Should fail with an unknown account block', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/user2',
            token: server.accessToken,
            statusCodeExpected: 404
          })
        })

        it('Should succeed with the correct params', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/user1',
            token: server.accessToken,
            statusCodeExpected: 204
          })
        })
      })
    })

    describe('When managing server servers blocklist', function () {
      const path = '/api/v1/server/blocklist/servers'

      describe('When listing blocked servers', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makeGetRequest({
            url: server.url,
            path,
            statusCodeExpected: 401
          })
        })

        it('Should fail with a user without the appropriate rights', async function () {
          await makeGetRequest({
            url: server.url,
            token: userAccessToken,
            path,
            statusCodeExpected: 403
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
      })

      describe('When blocking a server', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makePostBodyRequest({
            url: server.url,
            path,
            fields: { host: 'localhost:9002' },
            statusCodeExpected: 401
          })
        })

        it('Should fail with a user without the appropriate rights', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: userAccessToken,
            path,
            fields: { host: 'localhost:9002' },
            statusCodeExpected: 403
          })
        })

        it('Should fail with an unknown server', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { host: 'localhost:9003' },
            statusCodeExpected: 404
          })
        })

        it('Should fail with our own server', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { host: 'localhost:9001' },
            statusCodeExpected: 409
          })
        })

        it('Should succeed with the correct params', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { host: 'localhost:9002' },
            statusCodeExpected: 204
          })
        })
      })

      describe('When unblocking a server', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/localhost:9002',
            statusCodeExpected: 401
          })
        })

        it('Should fail with a user without the appropriate rights', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/localhost:9002',
            token: userAccessToken,
            statusCodeExpected: 403
          })
        })

        it('Should fail with an unknown server block', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/localhost:9003',
            token: server.accessToken,
            statusCodeExpected: 404
          })
        })

        it('Should succeed with the correct params', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/localhost:9002',
            token: server.accessToken,
            statusCodeExpected: 204
          })
        })
      })
    })
  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
