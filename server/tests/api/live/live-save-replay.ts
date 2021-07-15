/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { HttpStatusCode } from '@shared/core-utils'
import {
  checkLiveCleanup,
  cleanupTests,
  ConfigCommand,
  doubleFollow,
  flushAndRunMultipleServers,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  testFfmpegStreamError,
  wait,
  waitJobs
} from '@shared/extra-utils'
import { LiveVideoCreate, VideoPrivacy, VideoState } from '@shared/models'

const expect = chai.expect

describe('Save replay setting', function () {
  let servers: ServerInfo[] = []
  let liveVideoUUID: string
  let ffmpegCommand: FfmpegCommand

  async function createLiveWrapper (saveReplay: boolean) {
    if (liveVideoUUID) {
      try {
        await servers[0].videosCommand.remove({ id: liveVideoUUID })
        await waitJobs(servers)
      } catch {}
    }

    const attributes: LiveVideoCreate = {
      channelId: servers[0].videoChannel.id,
      privacy: VideoPrivacy.PUBLIC,
      name: 'my super live',
      saveReplay
    }

    const { uuid } = await servers[0].liveCommand.create({ fields: attributes })
    return uuid
  }

  async function checkVideosExist (videoId: string, existsInList: boolean, expectedStatus?: number) {
    for (const server of servers) {
      const length = existsInList ? 1 : 0

      const { data, total } = await server.videosCommand.list()
      expect(data).to.have.lengthOf(length)
      expect(total).to.equal(length)

      if (expectedStatus) {
        await server.videosCommand.get({ id: videoId, expectedStatus })
      }
    }
  }

  async function checkVideoState (videoId: string, state: VideoState) {
    for (const server of servers) {
      const video = await server.videosCommand.get({ id: videoId })
      expect(video.state.id).to.equal(state)
    }
  }

  async function waitUntilLivePublishedOnAllServers (videoId: string) {
    for (const server of servers) {
      await server.liveCommand.waitUntilPublished({ videoId })
    }
  }

  async function waitUntilLiveSavedOnAllServers (videoId: string) {
    for (const server of servers) {
      await server.liveCommand.waitUntilSaved({ videoId })
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

    await servers[0].configCommand.updateCustomSubConfig({
      newConfig: {
        live: {
          enabled: true,
          allowReplay: true,
          maxDuration: -1,
          transcoding: {
            enabled: false,
            resolutions: ConfigCommand.getCustomConfigResolutions(true)
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
      this.timeout(30000)

      ffmpegCommand = await servers[0].liveCommand.sendRTMPStreamInVideo({ videoId: liveVideoUUID })

      await waitUntilLivePublishedOnAllServers(liveVideoUUID)

      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, true, HttpStatusCode.OK_200)
      await checkVideoState(liveVideoUUID, VideoState.PUBLISHED)
    })

    it('Should correctly delete the video files after the stream ended', async function () {
      this.timeout(40000)

      await stopFfmpeg(ffmpegCommand)

      for (const server of servers) {
        await server.liveCommand.waitUntilEnded({ videoId: liveVideoUUID })
      }
      await waitJobs(servers)

      // Live still exist, but cannot be played anymore
      await checkVideosExist(liveVideoUUID, false, HttpStatusCode.OK_200)
      await checkVideoState(liveVideoUUID, VideoState.LIVE_ENDED)

      // No resolutions saved since we did not save replay
      await checkLiveCleanup(servers[0], liveVideoUUID, [])
    })

    it('Should correctly terminate the stream on blacklist and delete the live', async function () {
      this.timeout(40000)

      liveVideoUUID = await createLiveWrapper(false)

      ffmpegCommand = await servers[0].liveCommand.sendRTMPStreamInVideo({ videoId: liveVideoUUID })

      await waitUntilLivePublishedOnAllServers(liveVideoUUID)

      await waitJobs(servers)
      await checkVideosExist(liveVideoUUID, true, HttpStatusCode.OK_200)

      await Promise.all([
        servers[0].blacklistCommand.add({ videoId: liveVideoUUID, reason: 'bad live', unfederate: true }),
        testFfmpegStreamError(ffmpegCommand, true)
      ])

      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, false)

      await servers[0].videosCommand.get({ id: liveVideoUUID, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      await servers[1].videosCommand.get({ id: liveVideoUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

      await wait(5000)
      await waitJobs(servers)
      await checkLiveCleanup(servers[0], liveVideoUUID, [])
    })

    it('Should correctly terminate the stream on delete and delete the video', async function () {
      this.timeout(40000)

      liveVideoUUID = await createLiveWrapper(false)

      ffmpegCommand = await servers[0].liveCommand.sendRTMPStreamInVideo({ videoId: liveVideoUUID })

      await waitUntilLivePublishedOnAllServers(liveVideoUUID)

      await waitJobs(servers)
      await checkVideosExist(liveVideoUUID, true, HttpStatusCode.OK_200)

      await Promise.all([
        testFfmpegStreamError(ffmpegCommand, true),
        servers[0].videosCommand.remove({ id: liveVideoUUID })
      ])

      await wait(5000)
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

      ffmpegCommand = await servers[0].liveCommand.sendRTMPStreamInVideo({ videoId: liveVideoUUID })
      await waitUntilLivePublishedOnAllServers(liveVideoUUID)

      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, true, HttpStatusCode.OK_200)
      await checkVideoState(liveVideoUUID, VideoState.PUBLISHED)
    })

    it('Should correctly have saved the live and federated it after the streaming', async function () {
      this.timeout(30000)

      await stopFfmpeg(ffmpegCommand)

      await waitUntilLiveSavedOnAllServers(liveVideoUUID)
      await waitJobs(servers)

      // Live has been transcoded
      await checkVideosExist(liveVideoUUID, true, HttpStatusCode.OK_200)
      await checkVideoState(liveVideoUUID, VideoState.PUBLISHED)
    })

    it('Should update the saved live and correctly federate the updated attributes', async function () {
      this.timeout(30000)

      await servers[0].videosCommand.update({ id: liveVideoUUID, attributes: { name: 'video updated' } })
      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videosCommand.get({ id: liveVideoUUID })
        expect(video.name).to.equal('video updated')
        expect(video.isLive).to.be.false
      }
    })

    it('Should have cleaned up the live files', async function () {
      await checkLiveCleanup(servers[0], liveVideoUUID, [ 720 ])
    })

    it('Should correctly terminate the stream on blacklist and blacklist the saved replay video', async function () {
      this.timeout(40000)

      liveVideoUUID = await createLiveWrapper(true)

      ffmpegCommand = await servers[0].liveCommand.sendRTMPStreamInVideo({ videoId: liveVideoUUID })
      await waitUntilLivePublishedOnAllServers(liveVideoUUID)

      await waitJobs(servers)
      await checkVideosExist(liveVideoUUID, true, HttpStatusCode.OK_200)

      await Promise.all([
        servers[0].blacklistCommand.add({ videoId: liveVideoUUID, reason: 'bad live', unfederate: true }),
        testFfmpegStreamError(ffmpegCommand, true)
      ])

      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, false)

      await servers[0].videosCommand.get({ id: liveVideoUUID, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      await servers[1].videosCommand.get({ id: liveVideoUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

      await wait(5000)
      await waitJobs(servers)
      await checkLiveCleanup(servers[0], liveVideoUUID, [ 720 ])
    })

    it('Should correctly terminate the stream on delete and delete the video', async function () {
      this.timeout(40000)

      liveVideoUUID = await createLiveWrapper(true)

      ffmpegCommand = await servers[0].liveCommand.sendRTMPStreamInVideo({ videoId: liveVideoUUID })
      await waitUntilLivePublishedOnAllServers(liveVideoUUID)

      await waitJobs(servers)
      await checkVideosExist(liveVideoUUID, true, HttpStatusCode.OK_200)

      await Promise.all([
        servers[0].videosCommand.remove({ id: liveVideoUUID }),
        testFfmpegStreamError(ffmpegCommand, true)
      ])

      await wait(5000)
      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, false, HttpStatusCode.NOT_FOUND_404)
      await checkLiveCleanup(servers[0], liveVideoUUID, [])
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
