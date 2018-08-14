/* tslint:disable:no-unused-expression */

import 'mocha'

import {
  createUser,
  deleteVideoAbuse,
  flushTests,
  killallServers,
  makeGetRequest,
  makePostBodyRequest,
  runServer,
  ServerInfo,
  setAccessTokensToServers,
  updateVideoAbuse,
  uploadVideo,
  userLogin
} from '../../utils'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '../../utils/requests/check-api-params'
import { VideoAbuseState } from '../../../../shared/models/videos'

describe('Test video abuses API validators', function () {
  let server: ServerInfo
  let userAccessToken = ''
  let videoAbuseId: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])

    const username = 'user1'
    const password = 'my super password'
    await createUser(server.url, server.accessToken, username, password)
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

    it('Should fail with a reason too big', async function () {
      const fields = { reason: 'super'.repeat(61) }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with the correct parameters', async function () {
      const fields = { reason: 'super reason' }

      const res = await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 200 })
      videoAbuseId = res.body.videoAbuse.id
    })
  })

  describe('When updating a video abuse', function () {
    const basePath = '/api/v1/videos/'
    let path: string

    before(() => {
      path = basePath + server.video.id + '/abuse/' + videoAbuseId
    })

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
      const body = { moderationComment: 'b'.repeat(305) }
      await updateVideoAbuse(server.url, server.accessToken, server.video.uuid, videoAbuseId, body, 400)
    })

    it('Should succeed with the correct params', async function () {
      const body = { state: VideoAbuseState.ACCEPTED }
      await updateVideoAbuse(server.url, server.accessToken, server.video.uuid, videoAbuseId, body)
    })
  })

  describe('When deleting a video abuse', function () {
    const basePath = '/api/v1/videos/'
    let path: string

    before(() => {
      path = basePath + server.video.id + '/abuse/' + videoAbuseId
    })

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
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
