/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoRecommendationStrategy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { checkBadCountPagination, checkBadSort, checkBadStartPagination } from '@tests/shared/checks.js'

describe('Test recommendations API validator', function () {
  const path = '/api/v1/recommendations/videos'

  let server: PeerTubeServer
  let videoUUID: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    videoUUID = (await server.videos.quickUpload({ name: 'video' })).uuid
  })

  describe('When listing recommended videos', function () {
    const query = { strategy: VideoRecommendationStrategy.ANY_VIDEOS }

    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, null, query)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, null, query)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSort(server.url, path, null, query)
    })

    it('Should fail without a strategy', async function () {
      await makeGetRequest({ url: server.url, path, query: {}, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an invalid strategy', async function () {
      await makeGetRequest({ url: server.url, path, query: { strategy: 42 }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an invalid video id', async function () {
      await makeGetRequest({ url: server.url, path, query: { ...query, videoId: 'toto' }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail without a video id when the strategy requires one', async function () {
      for (const strategy of [ VideoRecommendationStrategy.ONLY_OWNER_VIDEOS, VideoRecommendationStrategy.ONLY_CHANNEL_VIDEOS ]) {
        await makeGetRequest({ url: server.url, path, query: { strategy }, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      }
    })

    it('Should fail with an unknown video', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        query: { strategy: VideoRecommendationStrategy.ONLY_CHANNEL_VIDEOS, videoId: '4da6fde3-88f7-4d16-b119-108df5630b06' },
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await makeGetRequest({ url: server.url, path, query, expectedStatus: HttpStatusCode.OK_200 })

      await makeGetRequest({
        url: server.url,
        path,
        query: { strategy: VideoRecommendationStrategy.ONLY_CHANNEL_VIDEOS, videoId: videoUUID },
        expectedStatus: HttpStatusCode.OK_200
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
