/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { LiveVideoCreate, VideoPrivacy, VideoState, VideoStateType } from '@peertube/peertube-models'
import {
  ConfigCommand,
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs
} from '@peertube/peertube-server-commands'
import { checkLiveCleanup } from '@tests/shared/live.js'
import { expect } from 'chai'

describe('Permanent live', function () {
  let servers: PeerTubeServer[] = []
  let videoUUID: string

  async function createLiveWrapper (permanentLive: boolean) {
    const attributes: LiveVideoCreate = {
      channelId: servers[0].store.channel.id,
      privacy: VideoPrivacy.PUBLIC,
      name: 'my super live',
      saveReplay: false,
      permanentLive
    }

    const { uuid } = await servers[0].live.create({ fields: attributes })
    return uuid
  }

  async function checkVideoState (videoId: string, state: VideoStateType) {
    for (const server of servers) {
      const video = await server.videos.get({ id: videoId })
      expect(video.state.id).to.equal(state)
    }
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableMinimumTranscoding()
    await servers[0].config.updateExistingConfig({
      newConfig: {
        live: {
          enabled: true,
          allowReplay: true,
          maxDuration: -1,
          transcoding: {
            enabled: true,
            resolutions: ConfigCommand.getCustomConfigResolutions(true)
          }
        }
      }
    })
  })

  it('Should create a non permanent live and update it to be a permanent live', async function () {
    this.timeout(20000)

    const videoUUID = await createLiveWrapper(false)

    {
      const live = await servers[0].live.get({ videoId: videoUUID })
      expect(live.permanentLive).to.be.false
    }

    await servers[0].live.update({ videoId: videoUUID, fields: { permanentLive: true } })

    {
      const live = await servers[0].live.get({ videoId: videoUUID })
      expect(live.permanentLive).to.be.true
    }
  })

  it('Should create a permanent live', async function () {
    this.timeout(20000)

    videoUUID = await createLiveWrapper(true)

    const live = await servers[0].live.get({ videoId: videoUUID })
    expect(live.permanentLive).to.be.true

    await waitJobs(servers)
  })

  it('Should stream into this permanent live', async function () {
    this.timeout(240_000)

    const beforePublication = new Date()
    const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: videoUUID })

    for (const server of servers) {
      await server.live.waitUntilPublished({ videoId: videoUUID })
    }

    await checkVideoState(videoUUID, VideoState.PUBLISHED)

    for (const server of servers) {
      const video = await server.videos.get({ id: videoUUID })
      expect(new Date(video.publishedAt)).greaterThan(beforePublication)
    }

    await stopFfmpeg(ffmpegCommand)
    await servers[0].live.waitUntilWaiting({ videoId: videoUUID })

    await waitJobs(servers)
  })

  it('Should have cleaned up this live', async function () {
    this.timeout(40000)

    await wait(5000)
    await waitJobs(servers)

    for (const server of servers) {
      const videoDetails = await server.videos.get({ id: videoUUID })

      expect(videoDetails.streamingPlaylists).to.have.lengthOf(0)
    }

    await checkLiveCleanup({ server: servers[0], permanent: true, videoUUID })
  })

  it('Should have set this live to waiting for live state', async function () {
    this.timeout(20000)

    await checkVideoState(videoUUID, VideoState.WAITING_FOR_LIVE)
  })

  it('Should be able to stream again in the permanent live', async function () {
    this.timeout(60000)

    await servers[0].config.updateExistingConfig({
      newConfig: {
        live: {
          enabled: true,
          allowReplay: true,
          maxDuration: -1,
          transcoding: {
            enabled: true,
            resolutions: ConfigCommand.getCustomConfigResolutions(false)
          }
        }
      }
    })

    const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: videoUUID })

    for (const server of servers) {
      await server.live.waitUntilPublished({ videoId: videoUUID })
    }

    await checkVideoState(videoUUID, VideoState.PUBLISHED)

    const count = await servers[0].live.countPlaylists({ videoUUID })
    // master playlist and 720p playlist
    expect(count).to.equal(2)

    await stopFfmpeg(ffmpegCommand)
  })

  it('Should have appropriate sessions', async function () {
    this.timeout(60000)

    await servers[0].live.waitUntilWaiting({ videoId: videoUUID })

    const { data, total } = await servers[0].live.listSessions({ videoId: videoUUID })
    expect(total).to.equal(2)
    expect(data).to.have.lengthOf(2)

    for (const session of data) {
      expect(session.startDate).to.exist
      expect(session.endDate).to.exist

      expect(session.error).to.not.exist
    }
  })

  it('Should remove the live and have cleaned up the directory', async function () {
    this.timeout(60000)

    await servers[0].videos.remove({ id: videoUUID })
    await waitJobs(servers)

    await checkLiveCleanup({ server: servers[0], permanent: true, videoUUID })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
