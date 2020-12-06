/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import {
  checkBadCountPagination,
  checkBadStartPagination,
  cleanupTests,
  flushAndRunServer,
  makeGetRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo
} from '../../../../shared/extra-utils'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'

describe('Test videos history API validator', function () {
  const myHistoryPath = '/api/v1/users/me/history/videos'
  const myHistoryRemove = myHistoryPath + '/remove'
  let watchingPath: string
  let server: ServerInfo

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    const res = await uploadVideo(server.url, server.accessToken, {})
    const videoUUID = res.body.video.uuid

    watchingPath = '/api/v1/videos/' + videoUUID + '/watching'
  })

  describe('When notifying a user is watching a video', function () {

    it('Should fail with an unauthenticated user', async function () {
      const fields = { currentTime: 5 }
      await makePutBodyRequest({ url: server.url, path: watchingPath, fields, statusCodeExpected: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with an incorrect video id', async function () {
      const fields = { currentTime: 5 }
      const path = '/api/v1/videos/blabla/watching'
      await makePutBodyRequest({
        url: server.url,
        path,
        fields,
        token: server.accessToken,
        statusCodeExpected: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with an unknown video', async function () {
      const fields = { currentTime: 5 }
      const path = '/api/v1/videos/d91fff41-c24d-4508-8e13-3bd5902c3b02/watching'

      await makePutBodyRequest({
        url: server.url,
        path,
        fields,
        token: server.accessToken,
        statusCodeExpected: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a bad current time', async function () {
      const fields = { currentTime: 'hello' }
      await makePutBodyRequest({
        url: server.url,
        path: watchingPath,
        fields,
        token: server.accessToken,
        statusCodeExpected: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with the correct parameters', async function () {
      const fields = { currentTime: 5 }

      await makePutBodyRequest({
        url: server.url,
        path: watchingPath,
        fields,
        token: server.accessToken,
        statusCodeExpected: HttpStatusCode.NO_CONTENT_204
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
      await makeGetRequest({ url: server.url, path: myHistoryPath, statusCodeExpected: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({ url: server.url, token: server.accessToken, path: myHistoryPath, statusCodeExpected: HttpStatusCode.OK_200 })
    })
  })

  describe('When removing user videos history', function () {
    it('Should fail with an unauthenticated user', async function () {
      await makePostBodyRequest({ url: server.url, path: myHistoryPath + '/remove', statusCodeExpected: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a bad beforeDate parameter', async function () {
      const body = { beforeDate: '15' }
      await makePostBodyRequest({
        url: server.url,
        token: server.accessToken,
        path: myHistoryRemove,
        fields: body,
        statusCodeExpected: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with a valid beforeDate param', async function () {
      const body = { beforeDate: new Date().toISOString() }
      await makePostBodyRequest({
        url: server.url,
        token: server.accessToken,
        path: myHistoryRemove,
        fields: body,
        statusCodeExpected: HttpStatusCode.NO_CONTENT_204
      })
    })

    it('Should succeed without body', async function () {
      await makePostBodyRequest({
        url: server.url,
        token: server.accessToken,
        path: myHistoryRemove,
        statusCodeExpected: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
