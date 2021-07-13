/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { HttpStatusCode } from '@shared/core-utils'
import {
  AbusesCommand,
  checkBadCountPagination,
  checkBadSortPagination,
  checkBadStartPagination,
  cleanupTests,
  doubleFollow,
  flushAndRunServer,
  getVideoIdFromUUID,
  makeGetRequest,
  makePostBodyRequest,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  waitJobs
} from '@shared/extra-utils'
import { AbuseCreate, AbuseState } from '@shared/models'

describe('Test abuses API validators', function () {
  const basePath = '/api/v1/abuses/'

  let server: ServerInfo

  let userToken = ''
  let userToken2 = ''
  let abuseId: number
  let messageId: number

  let command: AbusesCommand

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    const username = 'user1'
    const password = 'my super password'
    await server.usersCommand.create({ username: username, password: password })
    userToken = await server.loginCommand.getAccessToken({ username, password })

    userToken2 = await server.usersCommand.generateUserAndToken('user_2')

    const res = await uploadVideo(server.url, server.accessToken, {})
    server.video = res.body.video

    command = server.abusesCommand
  })

  describe('When listing abuses for admins', function () {
    const path = basePath

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
        statusCodeExpected: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non admin user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: userToken,
        statusCodeExpected: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with a bad id filter', async function () {
      await makeGetRequest({ url: server.url, path, token: server.accessToken, query: { id: 'toto' } })
    })

    it('Should fail with a bad filter', async function () {
      await makeGetRequest({ url: server.url, path, token: server.accessToken, query: { filter: 'toto' } })
      await makeGetRequest({ url: server.url, path, token: server.accessToken, query: { filter: 'videos' } })
    })

    it('Should fail with bad predefined reason', async function () {
      await makeGetRequest({ url: server.url, path, token: server.accessToken, query: { predefinedReason: 'violentOrRepulsives' } })
    })

    it('Should fail with a bad state filter', async function () {
      await makeGetRequest({ url: server.url, path, token: server.accessToken, query: { state: 'toto' } })
      await makeGetRequest({ url: server.url, path, token: server.accessToken, query: { state: 0 } })
    })

    it('Should fail with a bad videoIs filter', async function () {
      await makeGetRequest({ url: server.url, path, token: server.accessToken, query: { videoIs: 'toto' } })
    })

    it('Should succeed with the correct params', async function () {
      const query = {
        id: 13,
        predefinedReason: 'violentOrRepulsive',
        filter: 'comment',
        state: 2,
        videoIs: 'deleted'
      }

      await makeGetRequest({ url: server.url, path, token: server.accessToken, query, statusCodeExpected: HttpStatusCode.OK_200 })
    })
  })

  describe('When listing abuses for users', function () {
    const path = '/api/v1/users/me/abuses'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, userToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, userToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, userToken)
    })

    it('Should fail with a non authenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        statusCodeExpected: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a bad id filter', async function () {
      await makeGetRequest({ url: server.url, path, token: userToken, query: { id: 'toto' } })
    })

    it('Should fail with a bad state filter', async function () {
      await makeGetRequest({ url: server.url, path, token: userToken, query: { state: 'toto' } })
      await makeGetRequest({ url: server.url, path, token: userToken, query: { state: 0 } })
    })

    it('Should succeed with the correct params', async function () {
      const query = {
        id: 13,
        state: 2
      }

      await makeGetRequest({ url: server.url, path, token: userToken, query, statusCodeExpected: HttpStatusCode.OK_200 })
    })
  })

  describe('When reporting an abuse', function () {
    const path = basePath

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePostBodyRequest({ url: server.url, path, token: userToken, fields })
    })

    it('Should fail with a wrong video', async function () {
      const fields = { video: { id: 'blabla' }, reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: userToken, fields })
    })

    it('Should fail with an unknown video', async function () {
      const fields = { video: { id: 42 }, reason: 'my super reason' }
      await makePostBodyRequest({
        url: server.url,
        path,
        token: userToken,
        fields,
        statusCodeExpected: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a wrong comment', async function () {
      const fields = { comment: { id: 'blabla' }, reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: userToken, fields })
    })

    it('Should fail with an unknown comment', async function () {
      const fields = { comment: { id: 42 }, reason: 'my super reason' }
      await makePostBodyRequest({
        url: server.url,
        path,
        token: userToken,
        fields,
        statusCodeExpected: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a wrong account', async function () {
      const fields = { account: { id: 'blabla' }, reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: userToken, fields })
    })

    it('Should fail with an unknown account', async function () {
      const fields = { account: { id: 42 }, reason: 'my super reason' }
      await makePostBodyRequest({
        url: server.url,
        path,
        token: userToken,
        fields,
        statusCodeExpected: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with not account, comment or video', async function () {
      const fields = { reason: 'my super reason' }
      await makePostBodyRequest({
        url: server.url,
        path,
        token: userToken,
        fields,
        statusCodeExpected: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a non authenticated user', async function () {
      const fields = { video: { id: server.video.id }, reason: 'my super reason' }

      await makePostBodyRequest({ url: server.url, path, token: 'hello', fields, statusCodeExpected: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a reason too short', async function () {
      const fields = { video: { id: server.video.id }, reason: 'h' }

      await makePostBodyRequest({ url: server.url, path, token: userToken, fields })
    })

    it('Should fail with a too big reason', async function () {
      const fields = { video: { id: server.video.id }, reason: 'super'.repeat(605) }

      await makePostBodyRequest({ url: server.url, path, token: userToken, fields })
    })

    it('Should succeed with the correct parameters (basic)', async function () {
      const fields: AbuseCreate = { video: { id: server.video.shortUUID }, reason: 'my super reason' }

      const res = await makePostBodyRequest({
        url: server.url,
        path,
        token: userToken,
        fields,
        statusCodeExpected: HttpStatusCode.OK_200
      })
      abuseId = res.body.abuse.id
    })

    it('Should fail with a wrong predefined reason', async function () {
      const fields = { video: { id: server.video.id }, reason: 'my super reason', predefinedReasons: [ 'wrongPredefinedReason' ] }

      await makePostBodyRequest({ url: server.url, path, token: userToken, fields })
    })

    it('Should fail with negative timestamps', async function () {
      const fields = { video: { id: server.video.id, startAt: -1 }, reason: 'my super reason' }

      await makePostBodyRequest({ url: server.url, path, token: userToken, fields })
    })

    it('Should fail mith misordered startAt/endAt', async function () {
      const fields = { video: { id: server.video.id, startAt: 5, endAt: 1 }, reason: 'my super reason' }

      await makePostBodyRequest({ url: server.url, path, token: userToken, fields })
    })

    it('Should succeed with the corret parameters (advanced)', async function () {
      const fields: AbuseCreate = {
        video: {
          id: server.video.id,
          startAt: 1,
          endAt: 5
        },
        reason: 'my super reason',
        predefinedReasons: [ 'serverRules' ]
      }

      await makePostBodyRequest({ url: server.url, path, token: userToken, fields, statusCodeExpected: HttpStatusCode.OK_200 })
    })
  })

  describe('When updating an abuse', function () {

    it('Should fail with a non authenticated user', async function () {
      await command.update({ token: 'blabla', abuseId, body: {}, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a non admin user', async function () {
      await command.update({ token: userToken, abuseId, body: {}, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with a bad abuse id', async function () {
      await command.update({ abuseId: 45, body: {}, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a bad state', async function () {
      const body = { state: 5 }
      await command.update({ abuseId, body, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with a bad moderation comment', async function () {
      const body = { moderationComment: 'b'.repeat(3001) }
      await command.update({ abuseId, body, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should succeed with the correct params', async function () {
      const body = { state: AbuseState.ACCEPTED }
      await command.update({ abuseId, body })
    })
  })

  describe('When creating an abuse message', function () {
    const message = 'my super message'

    it('Should fail with an invalid abuse id', async function () {
      await command.addMessage({ token: userToken2, abuseId: 888, message, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a non authenticated user', async function () {
      await command.addMessage({ token: 'fake_token', abuseId, message, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with an invalid logged in user', async function () {
      await command.addMessage({ token: userToken2, abuseId, message, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with an invalid message', async function () {
      await command.addMessage({ token: userToken, abuseId, message: 'a'.repeat(5000), expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should suceed with the correct params', async function () {
      const res = await command.addMessage({ token: userToken, abuseId, message })
      messageId = res.body.abuseMessage.id
    })
  })

  describe('When listing abuse messages', function () {

    it('Should fail with an invalid abuse id', async function () {
      await command.listMessages({ token: userToken, abuseId: 888, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a non authenticated user', async function () {
      await command.listMessages({ token: 'fake_token', abuseId, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with an invalid logged in user', async function () {
      await command.listMessages({ token: userToken2, abuseId, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with the correct params', async function () {
      await command.listMessages({ token: userToken, abuseId })
    })
  })

  describe('When deleting an abuse message', function () {
    it('Should fail with an invalid abuse id', async function () {
      await command.deleteMessage({ token: userToken, abuseId: 888, messageId, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with an invalid message id', async function () {
      await command.deleteMessage({ token: userToken, abuseId, messageId: 888, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a non authenticated user', async function () {
      await command.deleteMessage({ token: 'fake_token', abuseId, messageId, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with an invalid logged in user', async function () {
      await command.deleteMessage({ token: userToken2, abuseId, messageId, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with the correct params', async function () {
      await command.deleteMessage({ token: userToken, abuseId, messageId })
    })
  })

  describe('When deleting a video abuse', function () {

    it('Should fail with a non authenticated user', async function () {
      await command.delete({ token: 'blabla', abuseId, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a non admin user', async function () {
      await command.delete({ token: userToken, abuseId, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with a bad abuse id', async function () {
      await command.delete({ abuseId: 45, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should succeed with the correct params', async function () {
      await command.delete({ abuseId })
    })
  })

  describe('When trying to manage messages of a remote abuse', function () {
    let remoteAbuseId: number
    let anotherServer: ServerInfo

    before(async function () {
      this.timeout(50000)

      anotherServer = await flushAndRunServer(2)
      await setAccessTokensToServers([ anotherServer ])

      await doubleFollow(anotherServer, server)

      const server2VideoId = await getVideoIdFromUUID(anotherServer.url, server.video.uuid)
      await anotherServer.abusesCommand.report({ reason: 'remote server', videoId: server2VideoId })

      await waitJobs([ server, anotherServer ])

      const body = await command.getAdminList({ sort: '-createdAt' })
      remoteAbuseId = body.data[0].id
    })

    it('Should fail when listing abuse messages of a remote abuse', async function () {
      await command.listMessages({ abuseId: remoteAbuseId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail when creating abuse message of a remote abuse', async function () {
      await command.addMessage({ abuseId: remoteAbuseId, message: 'message', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    after(async function () {
      await cleanupTests([ anotherServer ])
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
