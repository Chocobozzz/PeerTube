/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'

import {
  cleanupTests,
  createUser,
  deleteVideoAbuse,
  flushAndRunServer,
  makeGetRequest,
  makePostBodyRequest,
  ServerInfo,
  setAccessTokensToServers,
  updateVideoAbuse,
  uploadVideo,
  userLogin
} from '../../../../shared/extra-utils'
import {
  checkBadCountPagination,
  checkBadSortPagination,
  checkBadStartPagination
} from '../../../../shared/extra-utils/requests/check-api-params'
import { VideoAbuseState, VideoAbuseCreate } from '../../../../shared/models/videos'

describe('Test video abuses API validators', function () {
  let server: ServerInfo
  let userAccessToken = ''
  let videoAbuseId: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    const username = 'user1'
    const password = 'my super password'
    await createUser({ url: server.url, accessToken: server.accessToken, username: username, password: password })
    userAccessToken = await userLogin(server, { username, password })

    const res = await uploadVideo(server.url, server.accessToken, {})
    server.video = res.body.video
  })

  describe('When listing video abuses', function () {
    const path = '/api/v1/videos/abuse'

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

    it('Should fail with a non admin user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: userAccessToken,
        statusCodeExpected: 403
      })
    })

    it('Should fail with a bad id filter', async function () {
      await makeGetRequest({ url: server.url, path, token: server.accessToken, query: { id: 'toto' } })
    })

    it('Should fail with a bad state filter', async function () {
      await makeGetRequest({ url: server.url, path, token: server.accessToken, query: { state: 'toto' } })
    })

    it('Should fail with a bad videoIs filter', async function () {
      await makeGetRequest({ url: server.url, path, token: server.accessToken, query: { videoIs: 'toto' } })
    })

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({ url: server.url, path, token: server.accessToken, query: { id: 13 }, statusCodeExpected: 200 })
    })
  })

  describe('When reporting a video abuse', function () {
    const basePath = '/api/v1/videos/'
    let path: string

    before(() => {
      path = basePath + server.video.id + '/abuse'
    })

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a wrong video', async function () {
      const wrongPath = '/api/v1/videos/blabla/abuse'
      const fields = { reason: 'my super reason' }

      await makePostBodyRequest({ url: server.url, path: wrongPath, token: server.accessToken, fields })
    })

    it('Should fail with a non authenticated user', async function () {
      const fields = { reason: 'my super reason' }

      await makePostBodyRequest({ url: server.url, path, token: 'hello', fields, statusCodeExpected: 401 })
    })

    it('Should fail with a reason too short', async function () {
      const fields = { reason: 'h' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a too big reason', async function () {
      const fields = { reason: 'super'.repeat(605) }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with the correct parameters (basic)', async function () {
      const fields = { reason: 'my super reason' }

      const res = await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 200 })
      videoAbuseId = res.body.videoAbuse.id
    })

    it('Should fail with a wrong predefined reason', async function () {
      const fields = { reason: 'my super reason', predefinedReasons: [ 'wrongPredefinedReason' ] }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with negative timestamps', async function () {
      const fields = { reason: 'my super reason', startAt: -1 }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail mith misordered startAt/endAt', async function () {
      const fields = { reason: 'my super reason', startAt: 5, endAt: 1 }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with the corret parameters (advanced)', async function () {
      const fields: VideoAbuseCreate = { reason: 'my super reason', predefinedReasons: [ 'serverRules' ], startAt: 1, endAt: 5 }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 200 })
    })
  })

  describe('When updating a video abuse', function () {

    it('Should fail with a non authenticated user', async function () {
      await updateVideoAbuse(server.url, 'blabla', server.video.uuid, videoAbuseId, {}, 401)
    })

    it('Should fail with a non admin user', async function () {
      await updateVideoAbuse(server.url, userAccessToken, server.video.uuid, videoAbuseId, {}, 403)
    })

    it('Should fail with a bad video id or bad video abuse id', async function () {
      await updateVideoAbuse(server.url, server.accessToken, server.video.uuid, 45, {}, 404)
      await updateVideoAbuse(server.url, server.accessToken, 52, videoAbuseId, {}, 404)
    })

    it('Should fail with a bad state', async function () {
      const body = { state: 5 }
      await updateVideoAbuse(server.url, server.accessToken, server.video.uuid, videoAbuseId, body, 400)
    })

    it('Should fail with a bad moderation comment', async function () {
      const body = { moderationComment: 'b'.repeat(3001) }
      await updateVideoAbuse(server.url, server.accessToken, server.video.uuid, videoAbuseId, body, 400)
    })

    it('Should succeed with the correct params', async function () {
      const body = { state: VideoAbuseState.ACCEPTED }
      await updateVideoAbuse(server.url, server.accessToken, server.video.uuid, videoAbuseId, body)
    })
  })

  describe('When deleting a video abuse', function () {

    it('Should fail with a non authenticated user', async function () {
      await deleteVideoAbuse(server.url, 'blabla', server.video.uuid, videoAbuseId, 401)
    })

    it('Should fail with a non admin user', async function () {
      await deleteVideoAbuse(server.url, userAccessToken, server.video.uuid, videoAbuseId, 403)
    })

    it('Should fail with a bad video id or bad video abuse id', async function () {
      await deleteVideoAbuse(server.url, server.accessToken, server.video.uuid, 45, 404)
      await deleteVideoAbuse(server.url, server.accessToken, 52, videoAbuseId, 404)
    })

    it('Should succeed with the correct params', async function () {
      await deleteVideoAbuse(server.url, server.accessToken, server.video.uuid, videoAbuseId)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
