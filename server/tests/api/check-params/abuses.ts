/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { AbuseCreate, AbuseState } from '@shared/models'
import {
  addAbuseMessage,
  cleanupTests,
  createUser,
  deleteAbuse,
  deleteAbuseMessage,
  doubleFollow,
  flushAndRunServer,
  generateUserAccessToken,
  getAdminAbusesList,
  getVideoIdFromUUID,
  listAbuseMessages,
  makeGetRequest,
  makePostBodyRequest,
  reportAbuse,
  ServerInfo,
  setAccessTokensToServers,
  updateAbuse,
  uploadVideo,
  userLogin,
  waitJobs
} from '../../../../shared/extra-utils'
import {
  checkBadCountPagination,
  checkBadSortPagination,
  checkBadStartPagination
} from '../../../../shared/extra-utils/requests/check-api-params'

describe('Test abuses API validators', function () {
  const basePath = '/api/v1/abuses/'

  let server: ServerInfo

  let userAccessToken = ''
  let userAccessToken2 = ''
  let abuseId: number
  let messageId: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    const username = 'user1'
    const password = 'my super password'
    await createUser({ url: server.url, accessToken: server.accessToken, username: username, password: password })
    userAccessToken = await userLogin(server, { username, password })

    {
      userAccessToken2 = await generateUserAccessToken(server, 'user_2')
    }

    const res = await uploadVideo(server.url, server.accessToken, {})
    server.video = res.body.video
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

      await makeGetRequest({ url: server.url, path, token: server.accessToken, query, statusCodeExpected: 200 })
    })
  })

  describe('When listing abuses for users', function () {
    const path = '/api/v1/users/me/abuses'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, userAccessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, userAccessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, userAccessToken)
    })

    it('Should fail with a non authenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        statusCodeExpected: 401
      })
    })

    it('Should fail with a bad id filter', async function () {
      await makeGetRequest({ url: server.url, path, token: userAccessToken, query: { id: 'toto' } })
    })

    it('Should fail with a bad state filter', async function () {
      await makeGetRequest({ url: server.url, path, token: userAccessToken, query: { state: 'toto' } })
      await makeGetRequest({ url: server.url, path, token: userAccessToken, query: { state: 0 } })
    })

    it('Should succeed with the correct params', async function () {
      const query = {
        id: 13,
        state: 2
      }

      await makeGetRequest({ url: server.url, path, token: userAccessToken, query, statusCodeExpected: 200 })
    })
  })

  describe('When reporting an abuse', function () {
    const path = basePath

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePostBodyRequest({ url: server.url, path, token: userAccessToken, fields })
    })

    it('Should fail with a wrong video', async function () {
      const fields = { video: { id: 'blabla' }, reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: userAccessToken, fields })
    })

    it('Should fail with an unknown video', async function () {
      const fields = { video: { id: 42 }, reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: userAccessToken, fields, statusCodeExpected: 404 })
    })

    it('Should fail with a wrong comment', async function () {
      const fields = { comment: { id: 'blabla' }, reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: userAccessToken, fields })
    })

    it('Should fail with an unknown comment', async function () {
      const fields = { comment: { id: 42 }, reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: userAccessToken, fields, statusCodeExpected: 404 })
    })

    it('Should fail with a wrong account', async function () {
      const fields = { account: { id: 'blabla' }, reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: userAccessToken, fields })
    })

    it('Should fail with an unknown account', async function () {
      const fields = { account: { id: 42 }, reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: userAccessToken, fields, statusCodeExpected: 404 })
    })

    it('Should fail with not account, comment or video', async function () {
      const fields = { reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: userAccessToken, fields, statusCodeExpected: 400 })
    })

    it('Should fail with a non authenticated user', async function () {
      const fields = { video: { id: server.video.id }, reason: 'my super reason' }

      await makePostBodyRequest({ url: server.url, path, token: 'hello', fields, statusCodeExpected: 401 })
    })

    it('Should fail with a reason too short', async function () {
      const fields = { video: { id: server.video.id }, reason: 'h' }

      await makePostBodyRequest({ url: server.url, path, token: userAccessToken, fields })
    })

    it('Should fail with a too big reason', async function () {
      const fields = { video: { id: server.video.id }, reason: 'super'.repeat(605) }

      await makePostBodyRequest({ url: server.url, path, token: userAccessToken, fields })
    })

    it('Should succeed with the correct parameters (basic)', async function () {
      const fields: AbuseCreate = { video: { id: server.video.id }, reason: 'my super reason' }

      const res = await makePostBodyRequest({ url: server.url, path, token: userAccessToken, fields, statusCodeExpected: 200 })
      abuseId = res.body.abuse.id
    })

    it('Should fail with a wrong predefined reason', async function () {
      const fields = { video: { id: server.video.id }, reason: 'my super reason', predefinedReasons: [ 'wrongPredefinedReason' ] }

      await makePostBodyRequest({ url: server.url, path, token: userAccessToken, fields })
    })

    it('Should fail with negative timestamps', async function () {
      const fields = { video: { id: server.video.id, startAt: -1 }, reason: 'my super reason' }

      await makePostBodyRequest({ url: server.url, path, token: userAccessToken, fields })
    })

    it('Should fail mith misordered startAt/endAt', async function () {
      const fields = { video: { id: server.video.id, startAt: 5, endAt: 1 }, reason: 'my super reason' }

      await makePostBodyRequest({ url: server.url, path, token: userAccessToken, fields })
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

      await makePostBodyRequest({ url: server.url, path, token: userAccessToken, fields, statusCodeExpected: 200 })
    })
  })

  describe('When updating an abuse', function () {

    it('Should fail with a non authenticated user', async function () {
      await updateAbuse(server.url, 'blabla', abuseId, {}, 401)
    })

    it('Should fail with a non admin user', async function () {
      await updateAbuse(server.url, userAccessToken, abuseId, {}, 403)
    })

    it('Should fail with a bad abuse id', async function () {
      await updateAbuse(server.url, server.accessToken, 45, {}, 404)
    })

    it('Should fail with a bad state', async function () {
      const body = { state: 5 }
      await updateAbuse(server.url, server.accessToken, abuseId, body, 400)
    })

    it('Should fail with a bad moderation comment', async function () {
      const body = { moderationComment: 'b'.repeat(3001) }
      await updateAbuse(server.url, server.accessToken, abuseId, body, 400)
    })

    it('Should succeed with the correct params', async function () {
      const body = { state: AbuseState.ACCEPTED }
      await updateAbuse(server.url, server.accessToken, abuseId, body)
    })
  })

  describe('When creating an abuse message', function () {
    const message = 'my super message'

    it('Should fail with an invalid abuse id', async function () {
      await addAbuseMessage(server.url, userAccessToken2, 888, message, 404)
    })

    it('Should fail with a non authenticated user', async function () {
      await addAbuseMessage(server.url, 'fake_token', abuseId, message, 401)
    })

    it('Should fail with an invalid logged in user', async function () {
      await addAbuseMessage(server.url, userAccessToken2, abuseId, message, 403)
    })

    it('Should fail with an invalid message', async function () {
      await addAbuseMessage(server.url, userAccessToken, abuseId, 'a'.repeat(5000), 400)
    })

    it('Should suceed with the correct params', async function () {
      const res = await addAbuseMessage(server.url, userAccessToken, abuseId, message)
      messageId = res.body.abuseMessage.id
    })
  })

  describe('When listing abuse messages', function () {

    it('Should fail with an invalid abuse id', async function () {
      await listAbuseMessages(server.url, userAccessToken, 888, 404)
    })

    it('Should fail with a non authenticated user', async function () {
      await listAbuseMessages(server.url, 'fake_token', abuseId, 401)
    })

    it('Should fail with an invalid logged in user', async function () {
      await listAbuseMessages(server.url, userAccessToken2, abuseId, 403)
    })

    it('Should succeed with the correct params', async function () {
      await listAbuseMessages(server.url, userAccessToken, abuseId)
    })
  })

  describe('When deleting an abuse message', function () {

    it('Should fail with an invalid abuse id', async function () {
      await deleteAbuseMessage(server.url, userAccessToken, 888, messageId, 404)
    })

    it('Should fail with an invalid message id', async function () {
      await deleteAbuseMessage(server.url, userAccessToken, abuseId, 888, 404)
    })

    it('Should fail with a non authenticated user', async function () {
      await deleteAbuseMessage(server.url, 'fake_token', abuseId, messageId, 401)
    })

    it('Should fail with an invalid logged in user', async function () {
      await deleteAbuseMessage(server.url, userAccessToken2, abuseId, messageId, 403)
    })

    it('Should succeed with the correct params', async function () {
      await deleteAbuseMessage(server.url, userAccessToken, abuseId, messageId)
    })
  })

  describe('When deleting a video abuse', function () {

    it('Should fail with a non authenticated user', async function () {
      await deleteAbuse(server.url, 'blabla', abuseId, 401)
    })

    it('Should fail with a non admin user', async function () {
      await deleteAbuse(server.url, userAccessToken, abuseId, 403)
    })

    it('Should fail with a bad abuse id', async function () {
      await deleteAbuse(server.url, server.accessToken, 45, 404)
    })

    it('Should succeed with the correct params', async function () {
      await deleteAbuse(server.url, server.accessToken, abuseId)
    })
  })

  describe('When trying to manage messages of a remote abuse', function () {
    let remoteAbuseId: number
    let anotherServer: ServerInfo

    before(async function () {
      this.timeout(20000)

      anotherServer = await flushAndRunServer(2)
      await setAccessTokensToServers([ anotherServer ])

      await doubleFollow(anotherServer, server)

      const server2VideoId = await getVideoIdFromUUID(anotherServer.url, server.video.uuid)
      await reportAbuse({
        url: anotherServer.url,
        token: anotherServer.accessToken,
        reason: 'remote server',
        videoId: server2VideoId
      })

      await waitJobs([ server, anotherServer ])

      const res = await getAdminAbusesList({ url: server.url, token: server.accessToken, sort: '-createdAt' })
      remoteAbuseId = res.body.data[0].id
    })

    it('Should fail when listing abuse messages of a remote abuse', async function () {
      await listAbuseMessages(server.url, server.accessToken, remoteAbuseId, 400)
    })

    it('Should fail when creating abuse message of a remote abuse', async function () {
      await addAbuseMessage(server.url, server.accessToken, remoteAbuseId, 'message', 400)
    })

    after(async function () {
      await cleanupTests([ anotherServer ])
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
