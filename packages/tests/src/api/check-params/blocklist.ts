/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { checkBadCountPagination, checkBadSort, checkBadStartPagination } from '@tests/shared/checks.js'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeDeleteRequest,
  makeGetRequest,
  makePostBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

describe('Test blocklist API validators', function () {
  let servers: PeerTubeServer[]
  let server: PeerTubeServer
  let userAccessToken: string

  before(async function () {
    this.timeout(60000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    server = servers[0]

    const user = { username: 'user1', password: 'password' }
    await server.users.create({ username: user.username, password: user.password })

    userAccessToken = await server.login.getAccessToken(user)

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
            expectedStatus: HttpStatusCode.UNAUTHORIZED_401
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
      })

      describe('When blocking an account', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makePostBodyRequest({
            url: server.url,
            path,
            fields: { accountName: 'user1' },
            expectedStatus: HttpStatusCode.UNAUTHORIZED_401
          })
        })

        it('Should fail with an unknown account', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { accountName: 'user2' },
            expectedStatus: HttpStatusCode.NOT_FOUND_404
          })
        })

        it('Should fail to block ourselves', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { accountName: 'root' },
            expectedStatus: HttpStatusCode.CONFLICT_409
          })
        })

        it('Should succeed with the correct params', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { accountName: 'user1' },
            expectedStatus: HttpStatusCode.NO_CONTENT_204
          })
        })
      })

      describe('When unblocking an account', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/user1',
            expectedStatus: HttpStatusCode.UNAUTHORIZED_401
          })
        })

        it('Should fail with an unknown account block', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/user2',
            token: server.accessToken,
            expectedStatus: HttpStatusCode.NOT_FOUND_404
          })
        })

        it('Should succeed with the correct params', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/user1',
            token: server.accessToken,
            expectedStatus: HttpStatusCode.NO_CONTENT_204
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
            expectedStatus: HttpStatusCode.UNAUTHORIZED_401
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
      })

      describe('When blocking a server', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makePostBodyRequest({
            url: server.url,
            path,
            fields: { host: '127.0.0.1:9002' },
            expectedStatus: HttpStatusCode.UNAUTHORIZED_401
          })
        })

        it('Should succeed with an unknown server', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { host: '127.0.0.1:9003' },
            expectedStatus: HttpStatusCode.NO_CONTENT_204
          })
        })

        it('Should fail with our own server', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { host: server.host },
            expectedStatus: HttpStatusCode.CONFLICT_409
          })
        })

        it('Should succeed with the correct params', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { host: servers[1].host },
            expectedStatus: HttpStatusCode.NO_CONTENT_204
          })
        })
      })

      describe('When unblocking a server', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/' + servers[1].host,
            expectedStatus: HttpStatusCode.UNAUTHORIZED_401
          })
        })

        it('Should fail with an unknown server block', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/127.0.0.1:9004',
            token: server.accessToken,
            expectedStatus: HttpStatusCode.NOT_FOUND_404
          })
        })

        it('Should succeed with the correct params', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/' + servers[1].host,
            token: server.accessToken,
            expectedStatus: HttpStatusCode.NO_CONTENT_204
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
            expectedStatus: HttpStatusCode.UNAUTHORIZED_401
          })
        })

        it('Should fail with a user without the appropriate rights', async function () {
          await makeGetRequest({
            url: server.url,
            token: userAccessToken,
            path,
            expectedStatus: HttpStatusCode.FORBIDDEN_403
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
      })

      describe('When blocking an account', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makePostBodyRequest({
            url: server.url,
            path,
            fields: { accountName: 'user1' },
            expectedStatus: HttpStatusCode.UNAUTHORIZED_401
          })
        })

        it('Should fail with a user without the appropriate rights', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: userAccessToken,
            path,
            fields: { accountName: 'user1' },
            expectedStatus: HttpStatusCode.FORBIDDEN_403
          })
        })

        it('Should fail with an unknown account', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { accountName: 'user2' },
            expectedStatus: HttpStatusCode.NOT_FOUND_404
          })
        })

        it('Should fail to block ourselves', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { accountName: 'root' },
            expectedStatus: HttpStatusCode.CONFLICT_409
          })
        })

        it('Should succeed with the correct params', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { accountName: 'user1' },
            expectedStatus: HttpStatusCode.NO_CONTENT_204
          })
        })
      })

      describe('When unblocking an account', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/user1',
            expectedStatus: HttpStatusCode.UNAUTHORIZED_401
          })
        })

        it('Should fail with a user without the appropriate rights', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/user1',
            token: userAccessToken,
            expectedStatus: HttpStatusCode.FORBIDDEN_403
          })
        })

        it('Should fail with an unknown account block', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/user2',
            token: server.accessToken,
            expectedStatus: HttpStatusCode.NOT_FOUND_404
          })
        })

        it('Should succeed with the correct params', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/user1',
            token: server.accessToken,
            expectedStatus: HttpStatusCode.NO_CONTENT_204
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
            expectedStatus: HttpStatusCode.UNAUTHORIZED_401
          })
        })

        it('Should fail with a user without the appropriate rights', async function () {
          await makeGetRequest({
            url: server.url,
            token: userAccessToken,
            path,
            expectedStatus: HttpStatusCode.FORBIDDEN_403
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
      })

      describe('When blocking a server', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makePostBodyRequest({
            url: server.url,
            path,
            fields: { host: servers[1].host },
            expectedStatus: HttpStatusCode.UNAUTHORIZED_401
          })
        })

        it('Should fail with a user without the appropriate rights', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: userAccessToken,
            path,
            fields: { host: servers[1].host },
            expectedStatus: HttpStatusCode.FORBIDDEN_403
          })
        })

        it('Should succeed with an unknown server', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { host: '127.0.0.1:9003' },
            expectedStatus: HttpStatusCode.NO_CONTENT_204
          })
        })

        it('Should fail with our own server', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { host: server.host },
            expectedStatus: HttpStatusCode.CONFLICT_409
          })
        })

        it('Should succeed with the correct params', async function () {
          await makePostBodyRequest({
            url: server.url,
            token: server.accessToken,
            path,
            fields: { host: servers[1].host },
            expectedStatus: HttpStatusCode.NO_CONTENT_204
          })
        })
      })

      describe('When unblocking a server', function () {
        it('Should fail with an unauthenticated user', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/' + servers[1].host,
            expectedStatus: HttpStatusCode.UNAUTHORIZED_401
          })
        })

        it('Should fail with a user without the appropriate rights', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/' + servers[1].host,
            token: userAccessToken,
            expectedStatus: HttpStatusCode.FORBIDDEN_403
          })
        })

        it('Should fail with an unknown server block', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/127.0.0.1:9004',
            token: server.accessToken,
            expectedStatus: HttpStatusCode.NOT_FOUND_404
          })
        })

        it('Should succeed with the correct params', async function () {
          await makeDeleteRequest({
            url: server.url,
            path: path + '/' + servers[1].host,
            token: server.accessToken,
            expectedStatus: HttpStatusCode.NO_CONTENT_204
          })
        })
      })
    })
  })

  describe('When getting blocklist status', function () {
    const path = '/api/v1/blocklist/status'

    it('Should fail with a bad token', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: 'false',
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a bad accounts field', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        query: {
          accounts: 1
        },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await makeGetRequest({
        url: server.url,
        path,
        query: {
          accounts: [ 1 ]
        },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a bad hosts field', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        query: {
          hosts: 1
        },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await makeGetRequest({
        url: server.url,
        path,
        query: {
          hosts: [ 1 ]
        },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        query: {},
        expectedStatus: HttpStatusCode.OK_200
      })

      await makeGetRequest({
        url: server.url,
        path,
        query: {
          hosts: [ 'example.com' ],
          accounts: [ 'john@example.com' ]
        },
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
