/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '@tests/shared/checks.js'
import { HttpStatusCode, VideoCreateResult } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeDeleteRequest,
  makeGetRequest,
  makePostBodyRequest,
  makePutBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test server redundancy API validators', function () {
  let servers: PeerTubeServer[]
  let userAccessToken = null
  let videoIdLocal: number
  let videoRemote: VideoCreateResult

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    const user = {
      username: 'user1',
      password: 'password'
    }

    await servers[0].users.create({ username: user.username, password: user.password })
    userAccessToken = await servers[0].login.getAccessToken(user)

    videoIdLocal = (await servers[0].videos.quickUpload({ name: 'video' })).id

    const remoteUUID = (await servers[1].videos.quickUpload({ name: 'video' })).uuid

    await waitJobs(servers)

    videoRemote = await servers[0].videos.get({ id: remoteUUID })
  })

  describe('When listing redundancies', function () {
    const path = '/api/v1/server/redundancy/videos'

    let url: string
    let token: string

    before(function () {
      url = servers[0].url
      token = servers[0].accessToken
    })

    it('Should fail with an invalid token', async function () {
      await makeGetRequest({ url, path, token: 'fake_token', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail if the user is not an administrator', async function () {
      await makeGetRequest({ url, path, token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(url, path, servers[0].accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(url, path, servers[0].accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(url, path, servers[0].accessToken)
    })

    it('Should fail with a bad target', async function () {
      await makeGetRequest({ url, path, token, query: { target: 'bad target' } })
    })

    it('Should fail without target', async function () {
      await makeGetRequest({ url, path, token })
    })

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({ url, path, token, query: { target: 'my-videos' }, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('When manually adding a redundancy', function () {
    const path = '/api/v1/server/redundancy/videos'

    let url: string
    let token: string

    before(function () {
      url = servers[0].url
      token = servers[0].accessToken
    })

    it('Should fail with an invalid token', async function () {
      await makePostBodyRequest({ url, path, token: 'fake_token', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail if the user is not an administrator', async function () {
      await makePostBodyRequest({ url, path, token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail without a video id', async function () {
      await makePostBodyRequest({ url, path, token })
    })

    it('Should fail with an incorrect video id', async function () {
      await makePostBodyRequest({ url, path, token, fields: { videoId: 'peertube' } })
    })

    it('Should fail with a not found video id', async function () {
      await makePostBodyRequest({ url, path, token, fields: { videoId: 6565 }, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a local a video id', async function () {
      await makePostBodyRequest({ url, path, token, fields: { videoId: videoIdLocal } })
    })

    it('Should succeed with the correct params', async function () {
      await makePostBodyRequest({
        url,
        path,
        token,
        fields: { videoId: videoRemote.shortUUID },
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })

    it('Should fail if the video is already duplicated', async function () {
      this.timeout(30000)

      await waitJobs(servers)

      await makePostBodyRequest({
        url,
        path,
        token,
        fields: { videoId: videoRemote.uuid },
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
    })
  })

  describe('When manually removing a redundancy', function () {
    const path = '/api/v1/server/redundancy/videos/'

    let url: string
    let token: string

    before(function () {
      url = servers[0].url
      token = servers[0].accessToken
    })

    it('Should fail with an invalid token', async function () {
      await makeDeleteRequest({ url, path: path + '1', token: 'fake_token', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail if the user is not an administrator', async function () {
      await makeDeleteRequest({ url, path: path + '1', token: userAccessToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail with an incorrect video id', async function () {
      await makeDeleteRequest({ url, path: path + 'toto', token })
    })

    it('Should fail with a not found video redundancy', async function () {
      await makeDeleteRequest({ url, path: path + '454545', token, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })
  })

  describe('When updating server redundancy', function () {
    const path = '/api/v1/server/redundancy'

    it('Should fail with an invalid token', async function () {
      await makePutBodyRequest({
        url: servers[0].url,
        path: path + '/' + servers[1].host,
        fields: { redundancyAllowed: true },
        token: 'fake_token',
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail if the user is not an administrator', async function () {
      await makePutBodyRequest({
        url: servers[0].url,
        path: path + '/' + servers[1].host,
        fields: { redundancyAllowed: true },
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail if we do not follow this server', async function () {
      await makePutBodyRequest({
        url: servers[0].url,
        path: path + '/example.com',
        fields: { redundancyAllowed: true },
        token: servers[0].accessToken,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail without de redundancyAllowed param', async function () {
      await makePutBodyRequest({
        url: servers[0].url,
        path: path + '/' + servers[1].host,
        fields: { blabla: true },
        token: servers[0].accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makePutBodyRequest({
        url: servers[0].url,
        path: path + '/' + servers[1].host,
        fields: { redundancyAllowed: true },
        token: servers[0].accessToken,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
