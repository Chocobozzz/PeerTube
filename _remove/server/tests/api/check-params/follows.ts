/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '@server/tests/shared'
import { HttpStatusCode } from '@shared/models'
import {
  cleanupTests,
  createSingleServer,
  makeDeleteRequest,
  makeGetRequest,
  makePostBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@shared/server-commands'

describe('Test server follows API validators', function () {
  let server: PeerTubeServer

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
  })

  describe('When managing following', function () {
    let userAccessToken = null

    before(async function () {
      userAccessToken = await server.users.generateUserAndToken('user1')
    })

    describe('When adding follows', function () {
      const path = '/api/v1/server/following'

      it('Should fail with nothing', async function () {
        await makePostBodyRequest({
          url: server.url,
          path,
          token: server.accessToken,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should fail if hosts is not composed by hosts', async function () {
        await makePostBodyRequest({
          url: server.url,
          path,
          fields: { hosts: [ 'localhost:9002', 'localhost:coucou' ] },
          token: server.accessToken,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should fail if hosts is composed with http schemes', async function () {
        await makePostBodyRequest({
          url: server.url,
          path,
          fields: { hosts: [ 'localhost:9002', 'http://localhost:9003' ] },
          token: server.accessToken,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should fail if hosts are not unique', async function () {
        await makePostBodyRequest({
          url: server.url,
          path,
          fields: { urls: [ 'localhost:9002', 'localhost:9002' ] },
          token: server.accessToken,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should fail if handles is not composed by handles', async function () {
        await makePostBodyRequest({
          url: server.url,
          path,
          fields: { handles: [ 'hello@example.com', 'localhost:9001' ] },
          token: server.accessToken,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should fail if handles are not unique', async function () {
        await makePostBodyRequest({
          url: server.url,
          path,
          fields: { urls: [ 'hello@example.com', 'hello@example.com' ] },
          token: server.accessToken,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should fail with an invalid token', async function () {
        await makePostBodyRequest({
          url: server.url,
          path,
          fields: { hosts: [ 'localhost:9002' ] },
          token: 'fake_token',
          expectedStatus: HttpStatusCode.UNAUTHORIZED_401
        })
      })

      it('Should fail if the user is not an administrator', async function () {
        await makePostBodyRequest({
          url: server.url,
          path,
          fields: { hosts: [ 'localhost:9002' ] },
          token: userAccessToken,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
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

      it('Should fail with an incorrect state', async function () {
        await makeGetRequest({
          url: server.url,
          path,
          query: {
            state: 'blabla'
          }
        })
      })

      it('Should fail with an incorrect actor type', async function () {
        await makeGetRequest({
          url: server.url,
          path,
          query: {
            actorType: 'blabla'
          }
        })
      })

      it('Should fail succeed with the correct params', async function () {
        await makeGetRequest({
          url: server.url,
          path,
          expectedStatus: HttpStatusCode.OK_200,
          query: {
            state: 'accepted',
            actorType: 'Application'
          }
        })
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

      it('Should fail with an incorrect actor type', async function () {
        await makeGetRequest({
          url: server.url,
          path,
          query: {
            actorType: 'blabla'
          }
        })
      })

      it('Should fail with an incorrect state', async function () {
        await makeGetRequest({
          url: server.url,
          path,
          query: {
            state: 'blabla',
            actorType: 'Application'
          }
        })
      })

      it('Should fail succeed with the correct params', async function () {
        await makeGetRequest({
          url: server.url,
          path,
          expectedStatus: HttpStatusCode.OK_200,
          query: {
            state: 'accepted'
          }
        })
      })
    })

    describe('When removing a follower', function () {
      const path = '/api/v1/server/followers'

      it('Should fail with an invalid token', async function () {
        await makeDeleteRequest({
          url: server.url,
          path: path + '/toto@localhost:9002',
          token: 'fake_token',
          expectedStatus: HttpStatusCode.UNAUTHORIZED_401
        })
      })

      it('Should fail if the user is not an administrator', async function () {
        await makeDeleteRequest({
          url: server.url,
          path: path + '/toto@localhost:9002',
          token: userAccessToken,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      })

      it('Should fail with an invalid follower', async function () {
        await makeDeleteRequest({
          url: server.url,
          path: path + '/toto',
          token: server.accessToken,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should fail with an unknown follower', async function () {
        await makeDeleteRequest({
          url: server.url,
          path: path + '/toto@localhost:9003',
          token: server.accessToken,
          expectedStatus: HttpStatusCode.NOT_FOUND_404
        })
      })
    })

    describe('When accepting a follower', function () {
      const path = '/api/v1/server/followers'

      it('Should fail with an invalid token', async function () {
        await makePostBodyRequest({
          url: server.url,
          path: path + '/toto@localhost:9002/accept',
          token: 'fake_token',
          expectedStatus: HttpStatusCode.UNAUTHORIZED_401
        })
      })

      it('Should fail if the user is not an administrator', async function () {
        await makePostBodyRequest({
          url: server.url,
          path: path + '/toto@localhost:9002/accept',
          token: userAccessToken,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      })

      it('Should fail with an invalid follower', async function () {
        await makePostBodyRequest({
          url: server.url,
          path: path + '/toto/accept',
          token: server.accessToken,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should fail with an unknown follower', async function () {
        await makePostBodyRequest({
          url: server.url,
          path: path + '/toto@localhost:9003/accept',
          token: server.accessToken,
          expectedStatus: HttpStatusCode.NOT_FOUND_404
        })
      })
    })

    describe('When rejecting a follower', function () {
      const path = '/api/v1/server/followers'

      it('Should fail with an invalid token', async function () {
        await makePostBodyRequest({
          url: server.url,
          path: path + '/toto@localhost:9002/reject',
          token: 'fake_token',
          expectedStatus: HttpStatusCode.UNAUTHORIZED_401
        })
      })

      it('Should fail if the user is not an administrator', async function () {
        await makePostBodyRequest({
          url: server.url,
          path: path + '/toto@localhost:9002/reject',
          token: userAccessToken,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      })

      it('Should fail with an invalid follower', async function () {
        await makePostBodyRequest({
          url: server.url,
          path: path + '/toto/reject',
          token: server.accessToken,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      })

      it('Should fail with an unknown follower', async function () {
        await makePostBodyRequest({
          url: server.url,
          path: path + '/toto@localhost:9003/reject',
          token: server.accessToken,
          expectedStatus: HttpStatusCode.NOT_FOUND_404
        })
      })
    })

    describe('When removing following', function () {
      const path = '/api/v1/server/following'

      it('Should fail with an invalid token', async function () {
        await makeDeleteRequest({
          url: server.url,
          path: path + '/localhost:9002',
          token: 'fake_token',
          expectedStatus: HttpStatusCode.UNAUTHORIZED_401
        })
      })

      it('Should fail if the user is not an administrator', async function () {
        await makeDeleteRequest({
          url: server.url,
          path: path + '/localhost:9002',
          token: userAccessToken,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      })

      it('Should fail if we do not follow this server', async function () {
        await makeDeleteRequest({
          url: server.url,
          path: path + '/example.com',
          token: server.accessToken,
          expectedStatus: HttpStatusCode.NOT_FOUND_404
        })
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
