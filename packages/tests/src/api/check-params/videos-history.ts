/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { checkBadCountPagination, checkBadStartPagination } from '@tests/shared/checks.js'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeDeleteRequest,
  makeGetRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

describe('Test videos history API validator', function () {
  const myHistoryPath = '/api/v1/users/me/history/videos'
  const myHistoryRemove = myHistoryPath + '/remove'
  let viewPath: string
  let server: PeerTubeServer
  let videoId: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    const { id, uuid } = await server.videos.upload()
    viewPath = '/api/v1/videos/' + uuid + '/views'
    videoId = id
  })

  describe('When notifying a user is watching a video', function () {

    it('Should fail with a bad token', async function () {
      const fields = { currentTime: 5 }
      await makePutBodyRequest({ url: server.url, path: viewPath, fields, token: 'bad', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should succeed with the correct parameters', async function () {
      const fields = { currentTime: 5 }

      await makePutBodyRequest({
        url: server.url,
        path: viewPath,
        fields,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When listing user videos history', function () {
    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, myHistoryPath, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, myHistoryPath, server.accessToken)
    })

    it('Should fail with an unauthenticated user', async function () {
      await makeGetRequest({ url: server.url, path: myHistoryPath, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({ url: server.url, token: server.accessToken, path: myHistoryPath, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('When removing a specific user video history element', function () {
    let path: string

    before(function () {
      path = myHistoryPath + '/' + videoId
    })

    it('Should fail with an unauthenticated user', async function () {
      await makeDeleteRequest({ url: server.url, path, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a bad videoId parameter', async function () {
      await makeDeleteRequest({
        url: server.url,
        token: server.accessToken,
        path: myHistoryRemove + '/hi',
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeDeleteRequest({
        url: server.url,
        token: server.accessToken,
        path,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When removing all user videos history', function () {
    it('Should fail with an unauthenticated user', async function () {
      await makePostBodyRequest({ url: server.url, path: myHistoryPath + '/remove', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a bad beforeDate parameter', async function () {
      const body = { beforeDate: '15' }
      await makePostBodyRequest({
        url: server.url,
        token: server.accessToken,
        path: myHistoryRemove,
        fields: body,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with a valid beforeDate param', async function () {
      const body = { beforeDate: new Date().toISOString() }
      await makePostBodyRequest({
        url: server.url,
        token: server.accessToken,
        path: myHistoryRemove,
        fields: body,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })

    it('Should succeed without body', async function () {
      await makePostBodyRequest({
        url: server.url,
        token: server.accessToken,
        path: myHistoryRemove,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
