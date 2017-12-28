/* tslint:disable:no-unused-expression */

import 'mocha'

import {
  createUser, flushTests, killallServers, makeGetRequest, makePostBodyRequest, runServer, ServerInfo, setAccessTokensToServers,
  uploadVideo, userLogin
} from '../../utils'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '../../utils/requests/check-api-params'

describe('Test video abuses API validators', function () {
  let server: ServerInfo
  let userAccessToken = ''

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(20000)

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

    it('Should fail with nothing', async function () {
      const path = basePath + server.video.id + '/abuse'
      const fields = {}
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a wrong video', async function () {
      const wrongPath = '/api/v1/videos/blabla/abuse'
      const fields = {
        reason: 'my super reason'
      }
      await makePostBodyRequest({ url: server.url, path: wrongPath, token: server.accessToken, fields })
    })

    it('Should fail with a non authenticated user', async function () {
      const path = basePath + server.video.id + '/abuse'
      const fields = {
        reason: 'my super reason'
      }
      await makePostBodyRequest({ url: server.url, path, token: 'hello', fields, statusCodeExpected: 401 })
    })

    it('Should fail with a reason too short', async function () {
      const path = basePath + server.video.id + '/abuse'
      const fields = {
        reason: 'h'
      }
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a reason too big', async function () {
      const path = basePath + server.video.id + '/abuse'
      const fields = {
        reason: 'super'.repeat(61)
      }
      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
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
