/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { LiveVideoCreate, VideoDetails, VideoPrivacy, VideoState } from '@shared/models'
import {
  addVideoToBlacklist,
  checkLiveCleanup,
  cleanupTests,
  createLive,
  doubleFollow,
  flushAndRunMultipleServers,
  getVideo,
  getVideosList,
  removeVideo,
  sendRTMPStreamInVideo,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  testFfmpegStreamError,
  updateCustomSubConfig,
  updateVideo,
  waitJobs,
  waitUntilLivePublished
} from '../../../../shared/extra-utils'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'

const expect = chai.expect

describe('Save replay setting', function () {
  let servers: ServerInfo[] = []
  let liveVideoUUID: string
  let ffmpegCommand: FfmpegCommand

  async function createLiveWrapper (saveReplay: boolean) {
    if (liveVideoUUID) {
      try {
        await removeVideo(servers[0].url, servers[0].accessToken, liveVideoUUID)
        await waitJobs(servers)
      } catch {}
    }

    const attributes: LiveVideoCreate = {
      channelId: servers[0].videoChannel.id,
      privacy: VideoPrivacy.PUBLIC,
      name: 'my super live',
      saveReplay
    }

    const res = await createLive(servers[0].url, servers[0].accessToken, attributes)
    return res.body.video.uuid
  }

  async function checkVideosExist (videoId: string, existsInList: boolean, getStatus?: number) {
    for (const server of servers) {
      const length = existsInList ? 1 : 0

      const resVideos = await getVideosList(server.url)
      expect(resVideos.body.data).to.have.lengthOf(length)
      expect(resVideos.body.total).to.equal(length)

      if (getStatus) {
        await getVideo(server.url, videoId, getStatus)
      }
    }
  }

  async function checkVideoState (videoId: string, state: VideoState) {
    for (const server of servers) {
      const res = await getVideo(server.url, videoId)
      expect((res.body as VideoDetails).state.id).to.equal(state)
    }
  }

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    await updateCustomSubConfig(servers[0].url, servers[0].accessToken, {
      live: {
        enabled: true,
        allowReplay: true,
        maxDuration: -1,
        transcoding: {
          enabled: false,
          resolutions: {
            '240p': true,
            '360p': true,
            '480p': true,
            '720p': true,
            '1080p': true,
            '2160p': true
          }
        }
      }
    })
  })

  describe('With save replay disabled', function () {

    before(async function () {
      this.timeout(10000)
    })

    it('Should correctly create and federate the "waiting for stream" live', async function () {
      this.timeout(20000)

      liveVideoUUID = await createLiveWrapper(false)

      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, false, HttpStatusCode.OK_200)
      await checkVideoState(liveVideoUUID, VideoState.WAITING_FOR_LIVE)
    })

    it('Should correctly have updated the live and federated it when streaming in the live', async function () {
      this.timeout(20000)

      ffmpegCommand = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoUUID)
      await waitUntilLivePublished(servers[0].url, servers[0].accessToken, liveVideoUUID)

      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, true, HttpStatusCode.OK_200)
      await checkVideoState(liveVideoUUID, VideoState.PUBLISHED)
    })

    it('Should correctly delete the video files after the stream ended', async function () {
      this.timeout(40000)

      await stopFfmpeg(ffmpegCommand)

      await waitJobs(servers)

      // Live still exist, but cannot be played anymore
      await checkVideosExist(liveVideoUUID, false, HttpStatusCode.OK_200)
      await checkVideoState(liveVideoUUID, VideoState.LIVE_ENDED)

      await waitJobs(servers)

      // No resolutions saved since we did not save replay
      await checkLiveCleanup(servers[0], liveVideoUUID, [])
    })

    it('Should correctly terminate the stream on blacklist and delete the live', async function () {
      this.timeout(40000)

      liveVideoUUID = await createLiveWrapper(false)

      ffmpegCommand = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoUUID)
      await waitUntilLivePublished(servers[0].url, servers[0].accessToken, liveVideoUUID)

      await waitJobs(servers)
      await checkVideosExist(liveVideoUUID, true, HttpStatusCode.OK_200)

      await Promise.all([
        addVideoToBlacklist(servers[0].url, servers[0].accessToken, liveVideoUUID, 'bad live', true),
        testFfmpegStreamError(ffmpegCommand, true)
      ])

      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, false)

      await getVideo(servers[0].url, liveVideoUUID, HttpStatusCode.UNAUTHORIZED_401)
      await getVideo(servers[1].url, liveVideoUUID, HttpStatusCode.NOT_FOUND_404)

      await checkLiveCleanup(servers[0], liveVideoUUID, [])
    })

    it('Should correctly terminate the stream on delete and delete the video', async function () {
      this.timeout(40000)

      liveVideoUUID = await createLiveWrapper(false)

      ffmpegCommand = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoUUID)
      await waitUntilLivePublished(servers[0].url, servers[0].accessToken, liveVideoUUID)

      await waitJobs(servers)
      await checkVideosExist(liveVideoUUID, true, HttpStatusCode.OK_200)

      await Promise.all([
        testFfmpegStreamError(ffmpegCommand, true),
        removeVideo(servers[0].url, servers[0].accessToken, liveVideoUUID)
      ])

      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, false, HttpStatusCode.NOT_FOUND_404)
      await checkLiveCleanup(servers[0], liveVideoUUID, [])
    })
  })

  describe('With save replay enabled', function () {

    it('Should correctly create and federate the "waiting for stream" live', async function () {
      this.timeout(20000)

      liveVideoUUID = await createLiveWrapper(true)

      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, false, HttpStatusCode.OK_200)
      await checkVideoState(liveVideoUUID, VideoState.WAITING_FOR_LIVE)
    })

    it('Should correctly have updated the live and federated it when streaming in the live', async function () {
      this.timeout(20000)

      ffmpegCommand = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoUUID)
      await waitUntilLivePublished(servers[0].url, servers[0].accessToken, liveVideoUUID)

      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, true, HttpStatusCode.OK_200)
      await checkVideoState(liveVideoUUID, VideoState.PUBLISHED)
    })

    it('Should correctly have saved the live and federated it after the streaming', async function () {
      this.timeout(30000)

      await stopFfmpeg(ffmpegCommand)

      await waitJobs(servers)

      // Live has been transcoded
      await checkVideosExist(liveVideoUUID, true, HttpStatusCode.OK_200)
      await checkVideoState(liveVideoUUID, VideoState.PUBLISHED)
    })

    it('Should update the saved live and correctly federate the updated attributes', async function () {
      this.timeout(30000)

      await updateVideo(servers[0].url, servers[0].accessToken, liveVideoUUID, { name: 'video updated' })
      await waitJobs(servers)

      for (const server of servers) {
        const res = await getVideo(server.url, liveVideoUUID)
        expect(res.body.name).to.equal('video updated')
        expect(res.body.isLive).to.be.false
      }
    })

    it('Should have cleaned up the live files', async function () {
      await checkLiveCleanup(servers[0], liveVideoUUID, [ 720 ])
    })

    it('Should correctly terminate the stream on blacklist and blacklist the saved replay video', async function () {
      this.timeout(40000)

      liveVideoUUID = await createLiveWrapper(true)

      ffmpegCommand = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoUUID)
      await waitUntilLivePublished(servers[0].url, servers[0].accessToken, liveVideoUUID)

      await waitJobs(servers)
      await checkVideosExist(liveVideoUUID, true, HttpStatusCode.OK_200)

      await Promise.all([
        addVideoToBlacklist(servers[0].url, servers[0].accessToken, liveVideoUUID, 'bad live', true),
        testFfmpegStreamError(ffmpegCommand, true)
      ])

      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, false)

      await getVideo(servers[0].url, liveVideoUUID, HttpStatusCode.UNAUTHORIZED_401)
      await getVideo(servers[1].url, liveVideoUUID, HttpStatusCode.NOT_FOUND_404)

      await checkLiveCleanup(servers[0], liveVideoUUID, [ 720 ])
    })

    it('Should correctly terminate the stream on delete and delete the video', async function () {
      this.timeout(40000)

      liveVideoUUID = await createLiveWrapper(true)

      ffmpegCommand = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoUUID)
      await waitUntilLivePublished(servers[0].url, servers[0].accessToken, liveVideoUUID)

      await waitJobs(servers)
      await checkVideosExist(liveVideoUUID, true, HttpStatusCode.OK_200)

      await Promise.all([
        removeVideo(servers[0].url, servers[0].accessToken, liveVideoUUID),
        testFfmpegStreamError(ffmpegCommand, true)
      ])

      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, false, HttpStatusCode.NOT_FOUND_404)
      await checkLiveCleanup(servers[0], liveVideoUUID, [])
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
