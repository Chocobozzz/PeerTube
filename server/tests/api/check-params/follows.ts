/* tslint:disable:no-unused-expression */

import 'mocha'

import {
  createUser, flushTests, killallServers, makeDeleteRequest, makePostBodyRequest, runServer, ServerInfo, setAccessTokensToServers,
  userLogin
} from '../../utils'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '../../utils/requests/check-api-params'

describe('Test server follows API validators', function () {
  let server: ServerInfo

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    await flushTests()
    server = await runServer(1)

    await setAccessTokensToServers([ server ])
  })

  describe('When managing following', function () {
    let userAccessToken = null

    before(async function () {
      const user = {
        username: 'user1',
        password: 'password'
      }

      await createUser(server.url, server.accessToken, user.username, user.password)
      userAccessToken = await userLogin(server, user)
    })

    describe('When adding follows', function () {
      const path = '/api/v1/server/following'

      it('Should fail without hosts', async function () {
        await makePostBodyRequest({
          url: server.url,
          path,
          token: server.accessToken,
          statusCodeExpected: 400
        })
      })

      it('Should fail if hosts is not an array', async function () {
        await makePostBodyRequest({
          url: server.url,
          path,
          token: server.accessToken,
          fields: { hosts: 'localhost:9002' },
          statusCodeExpected: 400
        })
      })

      it('Should fail if the array is not composed by hosts', async function () {
        await makePostBodyRequest({
          url: server.url,
          path,
          fields: { hosts: [ 'localhost:9002', 'localhost:coucou' ] },
          token: server.accessToken,
          statusCodeExpected: 400
        })
      })

      it('Should fail if the array is composed with http schemes', async function () {
        await makePostBodyRequest({
          url: server.url,
          path,
          fields: { hosts: [ 'localhost:9002', 'http://localhost:9003' ] },
          token: server.accessToken,
          statusCodeExpected: 400
        })
      })

      it('Should fail if hosts are not unique', async function () {
        await makePostBodyRequest({
          url: server.url,
          path,
          fields: { urls: [ 'localhost:9002', 'localhost:9002' ] },
          token: server.accessToken,
          statusCodeExpected: 400
        })
      })

      it('Should fail with an invalid token', async function () {
        await makePostBodyRequest({
          url: server.url,
          path,
          fields: { hosts: [ 'localhost:9002' ] },
          token: 'fake_token',
          statusCodeExpected: 401
        })
      })

      it('Should fail if the user is not an administrator', async function () {
        await makePostBodyRequest({
          url: server.url,
          path,
          fields: { hosts: [ 'localhost:9002' ] },
          token: userAccessToken,
          statusCodeExpected: 403
        })
      })
    })

    describe('When listing followings', function () {
      const path = '/api/v1/server/following'

      it('Should fail with a bad start pagination', async function () {
        await checkBadStartPagination(server.url, path)
      })

      it('Should fail with a bad count pagination', async function () {
        await checkBadCountPagination(server.url, path)
      })

      it('Should fail with an incorrect sort', async function () {
        await checkBadSortPagination(server.url, path)
      })
    })

    describe('When listing followers', function () {
      const path = '/api/v1/server/followers'

      it('Should fail with a bad start pagination', async function () {
        await checkBadStartPagination(server.url, path)
      })

      it('Should fail with a bad count pagination', async function () {
        await checkBadCountPagination(server.url, path)
      })

      it('Should fail with an incorrect sort', async function () {
        await checkBadSortPagination(server.url, path)
      })
    })

    describe('When removing following', function () {
      const path = '/api/v1/server/following'

      it('Should fail with an invalid token', async function () {
        await makeDeleteRequest({
          url: server.url,
          path: path + '/localhost:9002',
          token: 'fake_token',
          statusCodeExpected: 401
        })
      })

      it('Should fail if the user is not an administrator', async function () {
        await makeDeleteRequest({
          url: server.url,
          path: path + '/localhost:9002',
          token: userAccessToken,
          statusCodeExpected: 403
        })
      })

      it('Should fail if we do not follow this server', async function () {
        await makeDeleteRequest({
          url: server.url,
          path: path + '/example.com',
          token: server.accessToken,
          statusCodeExpected: 404
        })
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
