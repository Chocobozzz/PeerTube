/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { LiveVideoError, UserVideoQuota, VideoPrivacy } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests, createMultipleServers,
  doubleFollow,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs,
  waitUntilLiveReplacedByReplayOnAllServers,
  waitUntilLiveWaitingOnAllServers
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { checkLiveCleanup } from '../../shared/live.js'

describe('Test live constraints', function () {
  let servers: PeerTubeServer[] = []
  let userId: number
  let userAccessToken: string
  let userChannelId: number

  async function createLiveWrapper (options: { replay: boolean, permanent: boolean }) {
    const { replay, permanent } = options

    const liveAttributes = {
      name: 'user live',
      channelId: userChannelId,
      privacy: VideoPrivacy.PUBLIC,
      saveReplay: replay,
      replaySettings: options.replay ? { privacy: VideoPrivacy.PUBLIC } : undefined,
      permanentLive: permanent
    }

    const { uuid } = await servers[0].live.create({ token: userAccessToken, fields: liveAttributes })
    return uuid
  }

  async function checkSaveReplay (videoId: string, resolutions = [ 720 ]) {
    for (const server of servers) {
      const video = await server.videos.get({ id: videoId })
      expect(video.isLive).to.be.false
      expect(video.duration).to.be.greaterThan(0)
    }

    await checkLiveCleanup({ server: servers[0], permanent: false, videoUUID: videoId, savedResolutions: resolutions })
  }

  function updateQuota (options: { total: number, daily: number }) {
    return servers[0].users.update({
      userId,
      videoQuota: options.total,
      videoQuotaDaily: options.daily
    })
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await servers[0].config.enableMinimumTranscoding()
    await servers[0].config.enableLive({ allowReplay: true, transcoding: false })

    {
      const res = await servers[0].users.generate('user1')
      userId = res.userId
      userChannelId = res.userChannelId
      userAccessToken = res.token

      await updateQuota({ total: 1, daily: -1 })
    }

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  it('Should not have size limit if save replay is disabled', async function () {
    this.timeout(60000)

    const userVideoLiveoId = await createLiveWrapper({ replay: false, permanent: false })
    await servers[0].live.runAndTestStreamError({ token: userAccessToken, videoId: userVideoLiveoId, shouldHaveError: false })
  })

  it('Should have size limit depending on user global quota if save replay is enabled on non permanent live', async function () {
    this.timeout(60000)

    // Wait for user quota memoize cache invalidation
    await wait(5000)

    const userVideoLiveoId = await createLiveWrapper({ replay: true, permanent: false })
    await servers[0].live.runAndTestStreamError({ token: userAccessToken, videoId: userVideoLiveoId, shouldHaveError: true })

    await waitUntilLiveReplacedByReplayOnAllServers(servers, userVideoLiveoId)
    await waitJobs(servers)

    await checkSaveReplay(userVideoLiveoId)

    const session = await servers[0].live.getReplaySession({ videoId: userVideoLiveoId })
    expect(session.error).to.equal(LiveVideoError.QUOTA_EXCEEDED)
  })

  it('Should have size limit depending on user global quota if save replay is enabled on a permanent live', async function () {
    this.timeout(60000)

    // Wait for user quota memoize cache invalidation
    await wait(5000)

    const userVideoLiveoId = await createLiveWrapper({ replay: true, permanent: true })
    await servers[0].live.runAndTestStreamError({ token: userAccessToken, videoId: userVideoLiveoId, shouldHaveError: true })

    await waitJobs(servers)
    await waitUntilLiveWaitingOnAllServers(servers, userVideoLiveoId)

    const session = await servers[0].live.findLatestSession({ videoId: userVideoLiveoId })
    expect(session.error).to.equal(LiveVideoError.QUOTA_EXCEEDED)
  })

  it('Should have size limit depending on user daily quota if save replay is enabled', async function () {
    this.timeout(60000)

    // Wait for user quota memoize cache invalidation
    await wait(5000)

    await updateQuota({ total: -1, daily: 1 })

    const userVideoLiveoId = await createLiveWrapper({ replay: true, permanent: false })
    await servers[0].live.runAndTestStreamError({ token: userAccessToken, videoId: userVideoLiveoId, shouldHaveError: true })

    await waitUntilLiveReplacedByReplayOnAllServers(servers, userVideoLiveoId)
    await waitJobs(servers)

    await checkSaveReplay(userVideoLiveoId)

    const session = await servers[0].live.getReplaySession({ videoId: userVideoLiveoId })
    expect(session.error).to.equal(LiveVideoError.QUOTA_EXCEEDED)
  })

  it('Should succeed without quota limit', async function () {
    this.timeout(60000)

    // Wait for user quota memoize cache invalidation
    await wait(5000)

    await updateQuota({ total: 10 * 1000 * 1000, daily: -1 })

    const userVideoLiveoId = await createLiveWrapper({ replay: true, permanent: false })
    await servers[0].live.runAndTestStreamError({ token: userAccessToken, videoId: userVideoLiveoId, shouldHaveError: false })
  })

  it('Should have the same quota in admin and as a user', async function () {
    this.timeout(120000)

    const userVideoLiveoId = await createLiveWrapper({ replay: true, permanent: false })
    const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ token: userAccessToken, videoId: userVideoLiveoId })

    await servers[0].live.waitUntilPublished({ videoId: userVideoLiveoId })
    // Wait previous live cleanups
    await wait(3000)

    const baseQuota = await servers[0].users.getMyQuotaUsed({ token: userAccessToken })

    let quotaUser: UserVideoQuota

    do {
      await wait(500)

      quotaUser = await servers[0].users.getMyQuotaUsed({ token: userAccessToken })
    } while (quotaUser.videoQuotaUsed <= baseQuota.videoQuotaUsed)

    const { data } = await servers[0].users.list()
    const quotaAdmin = data.find(u => u.username === 'user1')

    expect(quotaUser.videoQuotaUsed).to.be.above(baseQuota.videoQuotaUsed)
    expect(quotaUser.videoQuotaUsedDaily).to.be.above(baseQuota.videoQuotaUsedDaily)

    expect(quotaAdmin.videoQuotaUsed).to.be.above(baseQuota.videoQuotaUsed)
    expect(quotaAdmin.videoQuotaUsedDaily).to.be.above(baseQuota.videoQuotaUsedDaily)

    expect(quotaUser.videoQuotaUsed).to.be.above(10)
    expect(quotaUser.videoQuotaUsedDaily).to.be.above(10)
    expect(quotaAdmin.videoQuotaUsed).to.be.above(10)
    expect(quotaAdmin.videoQuotaUsedDaily).to.be.above(10)

    await stopFfmpeg(ffmpegCommand)
  })

  it('Should have max duration limit', async function () {
    this.timeout(240000)

    await servers[0].config.updateExistingConfig({
      newConfig: {
        live: {
          enabled: true,
          allowReplay: true,
          maxDuration: 15,
          transcoding: {
            enabled: true,
            resolutions: {
              '144p': true,
              '240p': true,
              '360p': false,
              '480p': false,
              '720p': true,
              '1080p': false,
              '1440p': false,
              '2160p': false
            }
          }
        }
      }
    })

    const userVideoLiveoId = await createLiveWrapper({ replay: true, permanent: false })
    await servers[0].live.runAndTestStreamError({ token: userAccessToken, videoId: userVideoLiveoId, shouldHaveError: true })

    await waitUntilLiveReplacedByReplayOnAllServers(servers, userVideoLiveoId)
    await waitJobs(servers)

    await checkSaveReplay(userVideoLiveoId, [ 720, 240, 144 ])

    const session = await servers[0].live.getReplaySession({ videoId: userVideoLiveoId })
    expect(session.error).to.equal(LiveVideoError.DURATION_EXCEEDED)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
