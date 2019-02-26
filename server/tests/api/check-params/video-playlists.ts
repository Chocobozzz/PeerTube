/* tslint:disable:no-unused-expression */

import { omit } from 'lodash'
import 'mocha'
import { join } from 'path'
import { VideoPrivacy } from '../../../../shared/models/videos/video-privacy.enum'
import {
  createUser,
  flushTests,
  getMyUserInformation,
  immutableAssign,
  killallServers,
  makeGetRequest,
  makePostBodyRequest,
  makeUploadRequest,
  runServer,
  ServerInfo,
  setAccessTokensToServers,
  updateCustomSubConfig,
  userLogin
} from '../../../../shared/utils'
import {
  checkBadCountPagination,
  checkBadSortPagination,
  checkBadStartPagination
} from '../../../../shared/utils/requests/check-api-params'
import { getMagnetURI, getYoutubeVideoUrl } from '../../../../shared/utils/videos/video-imports'

describe('Test video playlists API validator', function () {
  const path = '/api/v1/videos/video-playlists'
  let server: ServerInfo
  let userAccessToken = ''

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
  })

  describe('When listing video playlists', function () {
    const globalPath = '/api/v1/video-playlists'
    const accountPath = '/api/v1/accounts/root/video-playlists'
    const videoChannelPath = '/api/v1/video-channels/root_channel/video-playlists'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, globalPath, server.accessToken)
      await checkBadStartPagination(server.url, accountPath, server.accessToken)
      await checkBadStartPagination(server.url, videoChannelPath, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, globalPath, server.accessToken)
      await checkBadCountPagination(server.url, accountPath, server.accessToken)
      await checkBadCountPagination(server.url, videoChannelPath, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, globalPath, server.accessToken)
      await checkBadSortPagination(server.url, accountPath, server.accessToken)
      await checkBadSortPagination(server.url, videoChannelPath, server.accessToken)
    })

    it('Should fail with a bad account parameter', async function () {
      const accountPath = '/api/v1/accounts/root2/video-playlists'

      await makeGetRequest({ url: server.url, path: accountPath, statusCodeExpected: 404, token: server.accessToken })
    })

    it('Should fail with a bad video channel parameter', async function () {
      const accountPath = '/api/v1/video-channels/bad_channel/video-playlists'

      await makeGetRequest({ url: server.url, path: accountPath, statusCodeExpected: 404, token: server.accessToken })
    })

    it('Should success with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path: globalPath, statusCodeExpected: 200, token: server.accessToken })
      await makeGetRequest({ url: server.url, path: accountPath, statusCodeExpected: 200, token: server.accessToken })
      await makeGetRequest({ url: server.url, path: videoChannelPath, statusCodeExpected: 200, token: server.accessToken })
    })
  })

  describe('When listing videos of a playlist', async function () {
    const path = '/api/v1/video-playlists'

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, server.accessToken)
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
