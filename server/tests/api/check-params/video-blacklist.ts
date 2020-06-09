/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'

import {
  cleanupTests,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  getBlacklistedVideosList,
  getVideo,
  getVideoWithToken,
  makePostBodyRequest,
  makePutBodyRequest,
  removeVideoFromBlacklist,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  userLogin,
  waitJobs
} from '../../../../shared/extra-utils'
import {
  checkBadCountPagination,
  checkBadSortPagination,
  checkBadStartPagination
} from '../../../../shared/extra-utils/requests/check-api-params'
import { VideoBlacklistType, VideoDetails } from '../../../../shared/models/videos'
import { expect } from 'chai'

describe('Test video blacklist API validators', function () {
  let servers: ServerInfo[]
  let notBlacklistedVideoId: number
  let remoteVideoUUID: string
  let userAccessToken1 = ''
  let userAccessToken2 = ''

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    {
      const username = 'user1'
      const password = 'my super password'
      await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username: username, password: password })
      userAccessToken1 = await userLogin(servers[0], { username, password })
    }

    {
      const username = 'user2'
      const password = 'my super password'
      await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username: username, password: password })
      userAccessToken2 = await userLogin(servers[0], { username, password })
    }

    {
      const res = await uploadVideo(servers[0].url, userAccessToken1, {})
      servers[0].video = res.body.video
    }

    {
      const res = await uploadVideo(servers[0].url, servers[0].accessToken, {})
      notBlacklistedVideoId = res.body.video.uuid
    }

    {
      const res = await uploadVideo(servers[1].url, servers[1].accessToken, {})
      remoteVideoUUID = res.body.video.uuid
    }

    await waitJobs(servers)
  })

  describe('When adding a video in blacklist', function () {
    const basePath = '/api/v1/videos/'

    it('Should fail with nothing', async function () {
      const path = basePath + servers[0].video + '/blacklist'
      const fields = {}
      await makePostBodyRequest({ url: servers[0].url, path, token: servers[0].accessToken, fields })
    })

    it('Should fail with a wrong video', async function () {
      const wrongPath = '/api/v1/videos/blabla/blacklist'
      const fields = {}
      await makePostBodyRequest({ url: servers[0].url, path: wrongPath, token: servers[0].accessToken, fields })
    })

    it('Should fail with a non authenticated user', async function () {
      const path = basePath + servers[0].video + '/blacklist'
      const fields = {}
      await makePostBodyRequest({ url: servers[0].url, path, token: 'hello', fields, statusCodeExpected: 401 })
    })

    it('Should fail with a non admin user', async function () {
      const path = basePath + servers[0].video + '/blacklist'
      const fields = {}
      await makePostBodyRequest({ url: servers[0].url, path, token: userAccessToken2, fields, statusCodeExpected: 403 })
    })

    it('Should fail with an invalid reason', async function () {
      const path = basePath + servers[0].video.uuid + '/blacklist'
      const fields = { reason: 'a'.repeat(305) }

      await makePostBodyRequest({ url: servers[0].url, path, token: servers[0].accessToken, fields })
    })

    it('Should fail to unfederate a remote video', async function () {
      const path = basePath + remoteVideoUUID + '/blacklist'
      const fields = { unfederate: true }

      await makePostBodyRequest({ url: servers[0].url, path, token: servers[0].accessToken, fields, statusCodeExpected: 409 })
    })

    it('Should succeed with the correct params', async function () {
      const path = basePath + servers[0].video.uuid + '/blacklist'
      const fields = {}

      await makePostBodyRequest({ url: servers[0].url, path, token: servers[0].accessToken, fields, statusCodeExpected: 204 })
    })
  })

  describe('When updating a video in blacklist', function () {
    const basePath = '/api/v1/videos/'

    it('Should fail with a wrong video', async function () {
      const wrongPath = '/api/v1/videos/blabla/blacklist'
      const fields = {}
      await makePutBodyRequest({ url: servers[0].url, path: wrongPath, token: servers[0].accessToken, fields })
    })

    it('Should fail with a video not blacklisted', async function () {
      const path = '/api/v1/videos/' + notBlacklistedVideoId + '/blacklist'
      const fields = {}
      await makePutBodyRequest({ url: servers[0].url, path, token: servers[0].accessToken, fields, statusCodeExpected: 404 })
    })

    it('Should fail with a non authenticated user', async function () {
      const path = basePath + servers[0].video + '/blacklist'
      const fields = {}
      await makePutBodyRequest({ url: servers[0].url, path, token: 'hello', fields, statusCodeExpected: 401 })
    })

    it('Should fail with a non admin user', async function () {
      const path = basePath + servers[0].video + '/blacklist'
      const fields = {}
      await makePutBodyRequest({ url: servers[0].url, path, token: userAccessToken2, fields, statusCodeExpected: 403 })
    })

    it('Should fail with an invalid reason', async function () {
      const path = basePath + servers[0].video.uuid + '/blacklist'
      const fields = { reason: 'a'.repeat(305) }

      await makePutBodyRequest({ url: servers[0].url, path, token: servers[0].accessToken, fields })
    })

    it('Should succeed with the correct params', async function () {
      const path = basePath + servers[0].video.uuid + '/blacklist'
      const fields = { reason: 'hello' }

      await makePutBodyRequest({ url: servers[0].url, path, token: servers[0].accessToken, fields, statusCodeExpected: 204 })
    })
  })

  describe('When getting blacklisted video', function () {

    it('Should fail with a non authenticated user', async function () {
      await getVideo(servers[0].url, servers[0].video.uuid, 401)
    })

    it('Should fail with another user', async function () {
      await getVideoWithToken(servers[0].url, userAccessToken2, servers[0].video.uuid, 403)
    })

    it('Should succeed with the owner authenticated user', async function () {
      const res = await getVideoWithToken(servers[0].url, userAccessToken1, servers[0].video.uuid, 200)
      const video: VideoDetails = res.body

      expect(video.blacklisted).to.be.true
    })

    it('Should succeed with an admin', async function () {
      const res = await getVideoWithToken(servers[0].url, servers[0].accessToken, servers[0].video.uuid, 200)
      const video: VideoDetails = res.body

      expect(video.blacklisted).to.be.true
    })
  })

  describe('When removing a video in blacklist', function () {
    it('Should fail with a non authenticated user', async function () {
      await removeVideoFromBlacklist(servers[0].url, 'fake token', servers[0].video.uuid, 401)
    })

    it('Should fail with a non admin user', async function () {
      await removeVideoFromBlacklist(servers[0].url, userAccessToken2, servers[0].video.uuid, 403)
    })

    it('Should fail with an incorrect id', async function () {
      await removeVideoFromBlacklist(servers[0].url, servers[0].accessToken, 'hello', 400)
    })

    it('Should fail with a not blacklisted video', async function () {
      // The video was not added to the blacklist so it should fail
      await removeVideoFromBlacklist(servers[0].url, servers[0].accessToken, notBlacklistedVideoId, 404)
    })

    it('Should succeed with the correct params', async function () {
      await removeVideoFromBlacklist(servers[0].url, servers[0].accessToken, servers[0].video.uuid, 204)
    })
  })

  describe('When listing videos in blacklist', function () {
    const basePath = '/api/v1/videos/blacklist/'

    it('Should fail with a non authenticated user', async function () {
      await getBlacklistedVideosList({ url: servers[0].url, token: 'fake token', specialStatus: 401 })
    })

    it('Should fail with a non admin user', async function () {
      await getBlacklistedVideosList({ url: servers[0].url, token: userAccessToken2, specialStatus: 403 })
    })

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(servers[0].url, basePath, servers[0].accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(servers[0].url, basePath, servers[0].accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(servers[0].url, basePath, servers[0].accessToken)
    })

    it('Should fail with an invalid type', async function () {
      await getBlacklistedVideosList({ url: servers[0].url, token: servers[0].accessToken, type: 0, specialStatus: 400 })
    })

    it('Should succeed with the correct parameters', async function () {
      await getBlacklistedVideosList({ url: servers[0].url, token: servers[0].accessToken, type: VideoBlacklistType.MANUAL })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
