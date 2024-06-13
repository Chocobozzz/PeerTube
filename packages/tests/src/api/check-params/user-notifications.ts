/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { io } from 'socket.io-client'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '@tests/shared/checks.js'
import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserNotificationSetting, UserNotificationSettingValue } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

describe('Test user notifications API validators', function () {
  let server: PeerTubeServer

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
  })

  describe('When listing my notifications', function () {
    const path = '/api/v1/users/me/notifications'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, server.accessToken)
    })

    it('Should fail with an incorrect unread parameter', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        query: {
          unread: 'toto'
        },
        token: server.accessToken,
        expectedStatus: HttpStatusCode.OK_200
      })
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
        token: server.accessToken,
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  describe('When marking as read my notifications', function () {
    const path = '/api/v1/users/me/notifications/read'

    it('Should fail with wrong ids parameters', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: {
          ids: [ 'hello' ]
        },
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        fields: {
          ids: [ ]
        },
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await makePostBodyRequest({
        url: server.url,
        path,
        fields: {
          ids: 5
        },
        token: server.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a non authenticated user', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: {
          ids: [ 5 ]
        },
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        fields: {
          ids: [ 5 ]
        },
        token: server.accessToken,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When marking as read my notifications', function () {
    const path = '/api/v1/users/me/notifications/read-all'

    it('Should fail with a non authenticated user', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When updating my notification settings', function () {
    const path = '/api/v1/users/me/notification-settings'
    const correctFields: UserNotificationSetting = {
      newVideoFromSubscription: UserNotificationSettingValue.WEB,
      newCommentOnMyVideo: UserNotificationSettingValue.WEB,
      abuseAsModerator: UserNotificationSettingValue.WEB,
      videoAutoBlacklistAsModerator: UserNotificationSettingValue.WEB,
      blacklistOnMyVideo: UserNotificationSettingValue.WEB,
      myVideoImportFinished: UserNotificationSettingValue.WEB,
      myVideoPublished: UserNotificationSettingValue.WEB,
      commentMention: UserNotificationSettingValue.WEB,
      newFollow: UserNotificationSettingValue.WEB,
      newUserRegistration: UserNotificationSettingValue.WEB,
      newInstanceFollower: UserNotificationSettingValue.WEB,
      autoInstanceFollowing: UserNotificationSettingValue.WEB,
      abuseNewMessage: UserNotificationSettingValue.WEB,
      abuseStateChange: UserNotificationSettingValue.WEB,
      newPeerTubeVersion: UserNotificationSettingValue.WEB,
      myVideoStudioEditionFinished: UserNotificationSettingValue.WEB,
      myVideoTranscriptionGenerated: UserNotificationSettingValue.WEB,
      newPluginVersion: UserNotificationSettingValue.WEB
    }

    it('Should fail with missing fields', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: { newVideoFromSubscription: UserNotificationSettingValue.WEB },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with incorrect field values', async function () {
      {
        const fields = { ...correctFields, newCommentOnMyVideo: 15 }

        await makePutBodyRequest({
          url: server.url,
          path,
          token: server.accessToken,
          fields,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      }

      {
        const fields = { ...correctFields, newCommentOnMyVideo: 'toto' }

        await makePutBodyRequest({
          url: server.url,
          path,
          fields,
          token: server.accessToken,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      }
    })

    it('Should fail with a non authenticated user', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        fields: correctFields,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makePutBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: correctFields,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When connecting to my notification socket', function () {

    it('Should fail with no token', function (next) {
      const socket = io(`${server.url}/user-notifications`, { reconnection: false })

      socket.once('connect_error', function () {
        socket.disconnect()
        next()
      })

      socket.on('connect', () => {
        socket.disconnect()
        next(new Error('Connected with a missing token.'))
      })
    })

    it('Should fail with an invalid token', function (next) {
      const socket = io(`${server.url}/user-notifications`, {
        query: { accessToken: 'bad_access_token' },
        reconnection: false
      })

      socket.once('connect_error', function () {
        socket.disconnect()
        next()
      })

      socket.on('connect', () => {
        socket.disconnect()
        next(new Error('Connected with an invalid token.'))
      })
    })

    it('Should success with the correct token', function (next) {
      const socket = io(`${server.url}/user-notifications`, {
        query: { accessToken: server.accessToken },
        reconnection: false
      })

      function errorListener (err) {
        next(new Error('Error in connection: ' + err))
      }

      socket.on('connect_error', errorListener)

      socket.once('connect', async () => {
        socket.disconnect()

        await wait(500)
        next()
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
