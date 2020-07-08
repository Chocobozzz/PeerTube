/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { AbuseCreate, AbuseState } from '@shared/models'
import {
  cleanupTests,
  createUser,
  deleteAbuse,
  flushAndRunServer,
  makeGetRequest,
  makePostBodyRequest,
  ServerInfo,
  setAccessTokensToServers,
  updateAbuse,
  uploadVideo,
  userLogin
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
  let abuseId: number

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

  describe('When listing abuses', function () {
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

  describe('When reporting an abuse', function () {
    const path = basePath

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a wrong video', async function () {
      const fields = { video: { id: 'blabla' }, reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: server.accessToken, fields })
    })

    it('Should fail with an unknown video', async function () {
      const fields = { video: { id: 42 }, reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: server.accessToken, fields, statusCodeExpected: 404 })
    })

    it('Should fail with a wrong comment', async function () {
      const fields = { comment: { id: 'blabla' }, reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: server.accessToken, fields })
    })

    it('Should fail with an unknown comment', async function () {
      const fields = { comment: { id: 42 }, reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: server.accessToken, fields, statusCodeExpected: 404 })
    })

    it('Should fail with a wrong account', async function () {
      const fields = { account: { id: 'blabla' }, reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: server.accessToken, fields })
    })

    it('Should fail with an unknown account', async function () {
      const fields = { account: { id: 42 }, reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: server.accessToken, fields, statusCodeExpected: 404 })
    })

    it('Should fail with not account, comment or video', async function () {
      const fields = { reason: 'my super reason' }
      await makePostBodyRequest({ url: server.url, path: path, token: server.accessToken, fields, statusCodeExpected: 400 })
    })

    it('Should fail with a non authenticated user', async function () {
      const fields = { video: { id: server.video.id }, reason: 'my super reason' }

      await makePostBodyRequest({ url: server.url, path, token: 'hello', fields, statusCodeExpected: 401 })
    })

    it('Should fail with a reason too short', async function () {
      const fields = { video: { id: server.video.id }, reason: 'h' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a too big reason', async function () {
      const fields = { video: { id: server.video.id }, reason: 'super'.repeat(605) }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with the correct parameters (basic)', async function () {
      const fields: AbuseCreate = { video: { id: server.video.id }, reason: 'my super reason' }

      const res = await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 200 })
      abuseId = res.body.abuse.id
    })

    it('Should fail with a wrong predefined reason', async function () {
      const fields = { video: { id: server.video.id }, reason: 'my super reason', predefinedReasons: [ 'wrongPredefinedReason' ] }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with negative timestamps', async function () {
      const fields = { video: { id: server.video.id, startAt: -1 }, reason: 'my super reason' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail mith misordered startAt/endAt', async function () {
      const fields = { video: { id: server.video.id, startAt: 5, endAt: 1 }, reason: 'my super reason' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
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

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 200 })
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

  after(async function () {
    await cleanupTests([ server ])
  })
})
