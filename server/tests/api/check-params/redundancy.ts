/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'

import {
  checkBadCountPagination,
  checkBadSortPagination,
  checkBadStartPagination,
  cleanupTests,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers, makeDeleteRequest,
  makeGetRequest, makePostBodyRequest,
  makePutBodyRequest,
  ServerInfo,
  setAccessTokensToServers, uploadVideoAndGetId,
  userLogin, waitJobs, getVideoIdFromUUID
} from '../../../../shared/extra-utils'

describe('Test server redundancy API validators', function () {
  let servers: ServerInfo[]
  let userAccessToken = null
  let videoIdLocal: number
  let videoIdRemote: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    const user = {
      username: 'user1',
      password: 'password'
    }

    await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username: user.username, password: user.password })
    userAccessToken = await userLogin(servers[0], user)

    videoIdLocal = (await uploadVideoAndGetId({ server: servers[0], videoName: 'video' })).id

    const remoteUUID = (await uploadVideoAndGetId({ server: servers[1], videoName: 'video' })).uuid

    await waitJobs(servers)

    videoIdRemote = await getVideoIdFromUUID(servers[0].url, remoteUUID)
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
      await makeGetRequest({ url, path, token: 'fake_token', statusCodeExpected: 401 })
    })

    it('Should fail if the user is not an administrator', async function () {
      await makeGetRequest({ url, path, token: userAccessToken, statusCodeExpected: 403 })
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
      await makeGetRequest({ url, path, token, query: { target: 'my-videos' }, statusCodeExpected: 200 })
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
      await makePostBodyRequest({ url, path, token: 'fake_token', statusCodeExpected: 401 })
    })

    it('Should fail if the user is not an administrator', async function () {
      await makePostBodyRequest({ url, path, token: userAccessToken, statusCodeExpected: 403 })
    })

    it('Should fail without a video id', async function () {
      await makePostBodyRequest({ url, path, token })
    })

    it('Should fail with an incorrect video id', async function () {
      await makePostBodyRequest({ url, path, token, fields: { videoId: 'peertube' } })
    })

    it('Should fail with a not found video id', async function () {
      await makePostBodyRequest({ url, path, token, fields: { videoId: 6565 }, statusCodeExpected: 404 })
    })

    it('Should fail with a local a video id', async function () {
      await makePostBodyRequest({ url, path, token, fields: { videoId: videoIdLocal } })
    })

    it('Should succeed with the correct params', async function () {
      await makePostBodyRequest({ url, path, token, fields: { videoId: videoIdRemote }, statusCodeExpected: 204 })
    })

    it('Should fail if the video is already duplicated', async function () {
      this.timeout(30000)

      await waitJobs(servers)

      await makePostBodyRequest({ url, path, token, fields: { videoId: videoIdRemote }, statusCodeExpected: 409 })
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
      await makeDeleteRequest({ url, path: path + '1', token: 'fake_token', statusCodeExpected: 401 })
    })

    it('Should fail if the user is not an administrator', async function () {
      await makeDeleteRequest({ url, path: path + '1', token: userAccessToken, statusCodeExpected: 403 })
    })

    it('Should fail with an incorrect video id', async function () {
      await makeDeleteRequest({ url, path: path + 'toto', token })
    })

    it('Should fail with a not found video redundancy', async function () {
      await makeDeleteRequest({ url, path: path + '454545', token, statusCodeExpected: 404 })
    })
  })

  describe('When updating server redundancy', function () {
    const path = '/api/v1/server/redundancy'

    it('Should fail with an invalid token', async function () {
      await makePutBodyRequest({
        url: servers[0].url,
        path: path + '/localhost:' + servers[1].port,
        fields: { redundancyAllowed: true },
        token: 'fake_token',
        statusCodeExpected: 401
      })
    })

    it('Should fail if the user is not an administrator', async function () {
      await makePutBodyRequest({
        url: servers[0].url,
        path: path + '/localhost:' + servers[1].port,
        fields: { redundancyAllowed: true },
        token: userAccessToken,
        statusCodeExpected: 403
      })
    })

    it('Should fail if we do not follow this server', async function () {
      await makePutBodyRequest({
        url: servers[0].url,
        path: path + '/example.com',
        fields: { redundancyAllowed: true },
        token: servers[0].accessToken,
        statusCodeExpected: 404
      })
    })

    it('Should fail without de redundancyAllowed param', async function () {
      await makePutBodyRequest({
        url: servers[0].url,
        path: path + '/localhost:' + servers[1].port,
        fields: { blabla: true },
        token: servers[0].accessToken,
        statusCodeExpected: 400
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makePutBodyRequest({
        url: servers[0].url,
        path: path + '/localhost:' + servers[1].port,
        fields: { redundancyAllowed: true },
        token: servers[0].accessToken,
        statusCodeExpected: 204
      })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
