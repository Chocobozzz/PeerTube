/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoPrivacy, VideoRecommendationScope } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

describe('Test recommendations API validator', function () {
  const path = '/api/v1/recommendations/videos'

  let server: PeerTubeServer
  let videoUUID: string
  let privateVideoUUID: string
  let passwordProtectedVideoUUID: string
  let userToken: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    videoUUID = (await server.videos.quickUpload({ name: 'video' })).uuid
    privateVideoUUID = (await server.videos.quickUpload({ name: 'private video', privacy: VideoPrivacy.PRIVATE })).uuid
    passwordProtectedVideoUUID = (await server.videos.upload({
      attributes: { name: 'password protected video', privacy: VideoPrivacy.PASSWORD_PROTECTED, videoPasswords: [ 'password' ] }
    })).uuid

    userToken = await server.users.generateUserAndToken('user1')
  })

  describe('When listing recommended videos', function () {
    const query = { scope: VideoRecommendationScope.ALL }

    it('Should fail with an invalid scope', async function () {
      for (const scope of [ '', 42, 'toString' ]) {
        await makeGetRequest({ url: server.url, path, query: { scope }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      }
    })

    it('Should fail with an invalid video id', async function () {
      await makeGetRequest({ url: server.url, path, query: { ...query, videoId: 'toto' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail without a video id when the scope requires one', async function () {
      for (const scope of [ VideoRecommendationScope.ACCOUNT, VideoRecommendationScope.CHANNEL ]) {
        await makeGetRequest({ url: server.url, path, query: { scope }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      }
    })

    it('Should fail with an invalid count', async function () {
      for (const count of [ 0, 31, 'toto' ]) {
        await makeGetRequest({ url: server.url, path, query: { ...query, count }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      }
    })

    it('Should fail with invalid excluded video ids', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        query: { ...query, excludeVideoIds: [ 'toto' ] },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await makeGetRequest({
        url: server.url,
        path,
        query: { ...query, excludeVideoIds: Array.from({ length: 51 }, (_, i) => i + 1) },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with the same NSFW flags included and excluded', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        query: { ...query, nsfwFlagsIncluded: 1, nsfwFlagsExcluded: 1 },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with an unknown video', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        query: { scope: VideoRecommendationScope.CHANNEL, videoId: '4da6fde3-88f7-4d16-b119-108df5630b06' },
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a video the user cannot see', async function () {
      await server.videos.listRecommendations({
        scope: VideoRecommendationScope.CHANNEL,
        videoId: privateVideoUUID,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })

      await server.videos.listRecommendations({
        scope: VideoRecommendationScope.CHANNEL,
        videoId: privateVideoUUID,
        token: userToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with a password protected video without the password', async function () {
      await server.videos.listRecommendations({
        scope: VideoRecommendationScope.CHANNEL,
        videoId: passwordProtectedVideoUUID,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })

      await server.videos.listRecommendations({
        scope: VideoRecommendationScope.CHANNEL,
        videoId: passwordProtectedVideoUUID,
        videoPassword: 'bad password',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path, query, expectedStatus: HttpStatusCode.OK_200 })

      await makeGetRequest({ url: server.url, path, query: {}, expectedStatus: HttpStatusCode.OK_200 })
      await makeGetRequest({ url: server.url, path, query: { videoId: videoUUID }, expectedStatus: HttpStatusCode.OK_200 })

      await makeGetRequest({
        url: server.url,
        path,
        query: { scope: VideoRecommendationScope.CHANNEL, videoId: videoUUID, count: 30, excludeVideoIds: [ 1, 2 ] },
        expectedStatus: HttpStatusCode.OK_200
      })

      await server.videos.listRecommendations({
        scope: VideoRecommendationScope.CHANNEL,
        videoId: privateVideoUUID,
        token: server.accessToken
      })

      await server.videos.listRecommendations({
        scope: VideoRecommendationScope.CHANNEL,
        videoId: passwordProtectedVideoUUID,
        videoPassword: 'password'
      })
    })
  })

  describe('When setting the recommendation scope of a video', function () {
    it('Should fail with an invalid scope', async function () {
      for (const recommendationScope of [ null, 42 ]) {
        await server.videos.update({
          id: videoUUID,
          attributes: { recommendationScope: recommendationScope as any },
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        })
      }
    })

    it('Should succeed with a valid scope', async function () {
      await server.videos.update({ id: videoUUID, attributes: { recommendationScope: VideoRecommendationScope.LOCAL } })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
