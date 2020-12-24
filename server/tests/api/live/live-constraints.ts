/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { User, VideoDetails, VideoPrivacy } from '@shared/models'
import {
  checkLiveCleanup,
  cleanupTests,
  createLive,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  getMyUserInformation,
  getVideo,
  runAndTestFfmpegStreamError,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  updateCustomSubConfig,
  updateUser,
  userLogin,
  wait,
  waitJobs
} from '../../../../shared/extra-utils'

const expect = chai.expect

describe('Test live constraints', function () {
  let servers: ServerInfo[] = []
  let userId: number
  let userAccessToken: string
  let userChannelId: number

  async function createLiveWrapper (saveReplay: boolean) {
    const liveAttributes = {
      name: 'user live',
      channelId: userChannelId,
      privacy: VideoPrivacy.PUBLIC,
      saveReplay
    }

    const res = await createLive(servers[0].url, userAccessToken, liveAttributes)
    return res.body.video.uuid as string
  }

  async function checkSaveReplay (videoId: string, resolutions = [ 720 ]) {
    for (const server of servers) {
      const res = await getVideo(server.url, videoId)

      const video: VideoDetails = res.body
      expect(video.isLive).to.be.false
      expect(video.duration).to.be.greaterThan(0)
    }

    await checkLiveCleanup(servers[0], videoId, resolutions)
  }

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await updateCustomSubConfig(servers[0].url, servers[0].accessToken, {
      live: {
        enabled: true,
        allowReplay: true,
        transcoding: {
          enabled: false
        }
      }
    })

    {
      const user = { username: 'user1', password: 'superpassword' }
      const res = await createUser({
        url: servers[0].url,
        accessToken: servers[0].accessToken,
        username: user.username,
        password: user.password
      })
      userId = res.body.user.id

      userAccessToken = await userLogin(servers[0], user)

      const resMe = await getMyUserInformation(servers[0].url, userAccessToken)
      userChannelId = (resMe.body as User).videoChannels[0].id

      await updateUser({
        url: servers[0].url,
        userId,
        accessToken: servers[0].accessToken,
        videoQuota: 1,
        videoQuotaDaily: -1
      })
    }

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  it('Should not have size limit if save replay is disabled', async function () {
    this.timeout(60000)

    const userVideoLiveoId = await createLiveWrapper(false)
    await runAndTestFfmpegStreamError(servers[0].url, userAccessToken, userVideoLiveoId, false)
  })

  it('Should have size limit depending on user global quota if save replay is enabled', async function () {
    this.timeout(60000)

    // Wait for user quota memoize cache invalidation
    await wait(5000)

    const userVideoLiveoId = await createLiveWrapper(true)
    await runAndTestFfmpegStreamError(servers[0].url, userAccessToken, userVideoLiveoId, true)

    await waitJobs(servers)

    await checkSaveReplay(userVideoLiveoId)
  })

  it('Should have size limit depending on user daily quota if save replay is enabled', async function () {
    this.timeout(60000)

    // Wait for user quota memoize cache invalidation
    await wait(5000)

    await updateUser({
      url: servers[0].url,
      userId,
      accessToken: servers[0].accessToken,
      videoQuota: -1,
      videoQuotaDaily: 1
    })

    const userVideoLiveoId = await createLiveWrapper(true)
    await runAndTestFfmpegStreamError(servers[0].url, userAccessToken, userVideoLiveoId, true)

    await waitJobs(servers)

    await checkSaveReplay(userVideoLiveoId)
  })

  it('Should succeed without quota limit', async function () {
    this.timeout(60000)

    // Wait for user quota memoize cache invalidation
    await wait(5000)

    await updateUser({
      url: servers[0].url,
      userId,
      accessToken: servers[0].accessToken,
      videoQuota: 10 * 1000 * 1000,
      videoQuotaDaily: -1
    })

    const userVideoLiveoId = await createLiveWrapper(true)
    await runAndTestFfmpegStreamError(servers[0].url, userAccessToken, userVideoLiveoId, false)
  })

  it('Should have max duration limit', async function () {
    this.timeout(60000)

    await updateCustomSubConfig(servers[0].url, servers[0].accessToken, {
      live: {
        enabled: true,
        allowReplay: true,
        maxDuration: 1,
        transcoding: {
          enabled: true,
          resolutions: {
            '240p': true,
            '360p': true,
            '480p': true,
            '720p': true,
            '1080p': true,
            '1440p': true,
            '2160p': true
          }
        }
      }
    })

    const userVideoLiveoId = await createLiveWrapper(true)
    await runAndTestFfmpegStreamError(servers[0].url, userAccessToken, userVideoLiveoId, true)

    await waitJobs(servers)

    await checkSaveReplay(userVideoLiveoId, [ 720, 480, 360, 240 ])
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
