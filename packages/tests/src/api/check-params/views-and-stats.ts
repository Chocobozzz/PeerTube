/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'

describe('Test videos views API validators', function () {
  let servers: PeerTubeServer[]
  let liveVideoId: string
  let videoId: string
  let remoteVideoId: string

  let userAccessToken: string
  let editorToken: string

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await servers[0].config.enableLive({ allowReplay: false, transcoding: false })
    ;({ uuid: videoId } = await servers[0].videos.quickUpload({ name: 'video' }))
    ;({ uuid: remoteVideoId } = await servers[1].videos.quickUpload({ name: 'video' }))
    ;({ uuid: liveVideoId } = await servers[0].live.create({
      fields: {
        name: 'live',
        privacy: VideoPrivacy.PUBLIC,
        channelId: servers[0].store.channel.id
      }
    }))

    userAccessToken = await servers[0].users.generateUserAndToken('user')
    editorToken = await servers[0].channelCollaborators.createEditor('editor', 'root_channel')

    await doubleFollow(servers[0], servers[1])
  })

  describe('When viewing a video', async function () {
    it('Should fail without current time', async function () {
      await servers[0].views.view({ id: videoId, currentTime: undefined, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an invalid current time', async function () {
      await servers[0].views.view({ id: videoId, currentTime: null, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      await servers[0].views.view({ id: videoId, currentTime: -1, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      await servers[0].views.view({ id: videoId, currentTime: 10, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an invalid view event', async function () {
      await servers[0].views.view({
        id: videoId,
        currentTime: 1,
        viewEvent: 'seeko' as any,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with an invalid session id', async function () {
      await servers[0].views.view({ id: videoId, currentTime: 1, sessionId: 'tito_t', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an invalid client', async function () {
      await servers[0].views.view({
        id: videoId,
        currentTime: 1,
        client: 'a'.repeat(1000),
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with an invalid operating system', async function () {
      await servers[0].views.view({
        id: videoId,
        currentTime: 1,
        operatingSystem: 'a'.repeat(1000),
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with correct parameters', async function () {
      await servers[0].views.view({
        id: videoId,
        sessionId: 'titot',
        viewEvent: 'seek',
        client: 'chrome',
        device: 'super device' as any,
        operatingSystem: 'linux',
        currentTime: 1
      })
    })
  })

  describe('When getting overall/useragent stats', function () {
    async function testEndpoint (options: Parameters<PeerTubeServer['videoStats']['getOverallStats']>[0]) {
      await servers[0].videoStats.getOverallStats(options)
      await servers[0].videoStats.getUserAgentStats(options)
    }

    it('Should fail with a remote video', async function () {
      await testEndpoint({ videoId: remoteVideoId, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should fail without token', async function () {
      await testEndpoint({ videoId, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with another token', async function () {
      await testEndpoint({
        videoId,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an invalid start date', async function () {
      await testEndpoint({
        videoId,
        startDate: 'fake' as any,
        endDate: new Date().toISOString(),
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with an invalid end date', async function () {
      await testEndpoint({
        videoId,
        startDate: new Date().toISOString(),
        endDate: 'fake' as any,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with the correct parameters', async function () {
      for (const token of [ editorToken, servers[0].accessToken ]) {
        await testEndpoint({
          videoId,
          token,
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString()
        })
      }
    })
  })

  describe('When getting timeseries stats', function () {
    it('Should fail with a remote video', async function () {
      await servers[0].videoStats.getTimeserieStats({
        videoId: remoteVideoId,
        metric: 'viewers',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail without token', async function () {
      await servers[0].videoStats.getTimeserieStats({
        videoId,
        token: null,
        metric: 'viewers',
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with another token', async function () {
      await servers[0].videoStats.getTimeserieStats({
        videoId,
        token: userAccessToken,
        metric: 'viewers',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an invalid metric', async function () {
      await servers[0].videoStats.getTimeserieStats({ videoId, metric: 'hello' as any, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with an invalid start date', async function () {
      await servers[0].videoStats.getTimeserieStats({
        videoId,
        metric: 'viewers',
        startDate: 'fake' as any,
        endDate: new Date(),
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with an invalid end date', async function () {
      await servers[0].videoStats.getTimeserieStats({
        videoId,
        metric: 'viewers',
        startDate: new Date(),
        endDate: 'fake' as any,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail if start date is specified but not end date', async function () {
      await servers[0].videoStats.getTimeserieStats({
        videoId,
        metric: 'viewers',
        startDate: new Date(),
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail if end date is specified but not start date', async function () {
      await servers[0].videoStats.getTimeserieStats({
        videoId,
        metric: 'viewers',
        endDate: new Date(),
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a too big interval', async function () {
      await servers[0].videoStats.getTimeserieStats({
        videoId,
        metric: 'viewers',
        startDate: new Date('2000-04-07T08:31:57.126Z'),
        endDate: new Date(),
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with the correct parameters', async function () {
      for (const token of [ editorToken, servers[0].accessToken ]) {
        await servers[0].videoStats.getTimeserieStats({ videoId, token, metric: 'viewers' })
      }
    })
  })

  describe('When getting retention stats', function () {
    it('Should fail with a remote video', async function () {
      await servers[0].videoStats.getRetentionStats({
        videoId: remoteVideoId,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail without token', async function () {
      await servers[0].videoStats.getRetentionStats({
        videoId,
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with another token', async function () {
      await servers[0].videoStats.getRetentionStats({
        videoId,
        token: userAccessToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail on live video', async function () {
      await servers[0].videoStats.getRetentionStats({ videoId: liveVideoId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should succeed with the correct parameters', async function () {
      for (const token of [ editorToken, servers[0].accessToken ]) {
        await servers[0].videoStats.getRetentionStats({ videoId, token })
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
