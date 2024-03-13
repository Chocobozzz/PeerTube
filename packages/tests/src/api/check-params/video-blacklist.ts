/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '@tests/shared/checks.js'
import { HttpStatusCode, VideoBlacklistType } from '@peertube/peertube-models'
import {
  BlacklistCommand,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makePostBodyRequest,
  makePutBodyRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test video blacklist API validators', function () {
  let servers: PeerTubeServer[]
  let notBlacklistedVideoId: string
  let remoteVideoUUID: string
  let userAccessToken1 = ''
  let userAccessToken2 = ''
  let command: BlacklistCommand

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    {
      const username = 'user1'
      const password = 'my super password'
      await servers[0].users.create({ username, password })
      userAccessToken1 = await servers[0].login.getAccessToken({ username, password })
    }

    {
      const username = 'user2'
      const password = 'my super password'
      await servers[0].users.create({ username, password })
      userAccessToken2 = await servers[0].login.getAccessToken({ username, password })
    }

    {
      servers[0].store.videoCreated = await servers[0].videos.upload({ token: userAccessToken1 })
    }

    {
      const { uuid } = await servers[0].videos.upload()
      notBlacklistedVideoId = uuid
    }

    {
      const { uuid } = await servers[1].videos.upload()
      remoteVideoUUID = uuid
    }

    await waitJobs(servers)

    command = servers[0].blacklist
  })

  describe('When adding a video in blacklist', function () {
    const basePath = '/api/v1/videos/'

    it('Should fail with nothing', async function () {
      const path = basePath + servers[0].store.videoCreated + '/blacklist'
      const fields = {}
      await makePostBodyRequest({ url: servers[0].url, path, token: servers[0].accessToken, fields })
    })

    it('Should fail with a wrong video', async function () {
      const wrongPath = '/api/v1/videos/blabla/blacklist'
      const fields = {}
      await makePostBodyRequest({ url: servers[0].url, path: wrongPath, token: servers[0].accessToken, fields })
    })

    it('Should fail with a non authenticated user', async function () {
      const path = basePath + servers[0].store.videoCreated + '/blacklist'
      const fields = {}
      await makePostBodyRequest({ url: servers[0].url, path, token: 'hello', fields, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a non admin user', async function () {
      const path = basePath + servers[0].store.videoCreated + '/blacklist'
      const fields = {}
      await makePostBodyRequest({
        url: servers[0].url,
        path,
        token: userAccessToken2,
        fields,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an invalid reason', async function () {
      const path = basePath + servers[0].store.videoCreated.uuid + '/blacklist'
      const fields = { reason: 'a'.repeat(305) }

      await makePostBodyRequest({ url: servers[0].url, path, token: servers[0].accessToken, fields })
    })

    it('Should fail to unfederate a remote video', async function () {
      const path = basePath + remoteVideoUUID + '/blacklist'
      const fields = { unfederate: true }

      await makePostBodyRequest({
        url: servers[0].url,
        path,
        token: servers[0].accessToken,
        fields,
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
    })

    it('Should succeed with the correct params', async function () {
      const path = basePath + servers[0].store.videoCreated.uuid + '/blacklist'
      const fields = {}

      await makePostBodyRequest({
        url: servers[0].url,
        path,
        token: servers[0].accessToken,
        fields,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
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
      await makePutBodyRequest({
        url: servers[0].url,
        path,
        token: servers[0].accessToken,
        fields,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a non authenticated user', async function () {
      const path = basePath + servers[0].store.videoCreated + '/blacklist'
      const fields = {}
      await makePutBodyRequest({ url: servers[0].url, path, token: 'hello', fields, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a non admin user', async function () {
      const path = basePath + servers[0].store.videoCreated + '/blacklist'
      const fields = {}
      await makePutBodyRequest({
        url: servers[0].url,
        path,
        token: userAccessToken2,
        fields,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an invalid reason', async function () {
      const path = basePath + servers[0].store.videoCreated.uuid + '/blacklist'
      const fields = { reason: 'a'.repeat(305) }

      await makePutBodyRequest({ url: servers[0].url, path, token: servers[0].accessToken, fields })
    })

    it('Should succeed with the correct params', async function () {
      const path = basePath + servers[0].store.videoCreated.shortUUID + '/blacklist'
      const fields = { reason: 'hello' }

      await makePutBodyRequest({
        url: servers[0].url,
        path,
        token: servers[0].accessToken,
        fields,
        expectedStatus: HttpStatusCode.NO_CONTENT_204
      })
    })
  })

  describe('When getting blacklisted video', function () {

    it('Should fail with a non authenticated user', async function () {
      await servers[0].videos.get({ id: servers[0].store.videoCreated.uuid, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with another user', async function () {
      await servers[0].videos.getWithToken({
        token: userAccessToken2,
        id: servers[0].store.videoCreated.uuid,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with the owner authenticated user', async function () {
      const video = await servers[0].videos.getWithToken({ token: userAccessToken1, id: servers[0].store.videoCreated.uuid })
      expect(video.blacklisted).to.be.true
    })

    it('Should succeed with an admin', async function () {
      const video = servers[0].store.videoCreated

      for (const id of [ video.id, video.uuid, video.shortUUID ]) {
        const video = await servers[0].videos.getWithToken({ id, expectedStatus: HttpStatusCode.OK_200 })
        expect(video.blacklisted).to.be.true
      }
    })
  })

  describe('When removing a video in blacklist', function () {

    it('Should fail with a non authenticated user', async function () {
      await command.remove({
        token: 'faketoken',
        videoId: servers[0].store.videoCreated.uuid,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non admin user', async function () {
      await command.remove({
        token: userAccessToken2,
        videoId: servers[0].store.videoCreated.uuid,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an incorrect id', async function () {
      await command.remove({ videoId: 'hello', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with a not blacklisted video', async function () {
      // The video was not added to the blacklist so it should fail
      await command.remove({ videoId: notBlacklistedVideoId, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should succeed with the correct params', async function () {
      await command.remove({ videoId: servers[0].store.videoCreated.uuid, expectedStatus: HttpStatusCode.NO_CONTENT_204 })
    })
  })

  describe('When listing videos in blacklist', function () {
    const basePath = '/api/v1/videos/blacklist/'

    it('Should fail with a non authenticated user', async function () {
      await servers[0].blacklist.list({ token: 'faketoken', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a non admin user', async function () {
      await servers[0].blacklist.list({ token: userAccessToken2, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
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
      await servers[0].blacklist.list({ type: 0 as any, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should succeed with the correct parameters', async function () {
      await servers[0].blacklist.list({ type: VideoBlacklistType.MANUAL })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
