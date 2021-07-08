/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { LiveVideoCreate, VideoDetails, VideoPrivacy, VideoState } from '@shared/models'
import {
  cleanupTests,
  ConfigCommand,
  doubleFollow,
  flushAndRunMultipleServers,
  getVideo,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  wait,
  waitJobs
} from '../../../../shared/extra-utils'

const expect = chai.expect

describe('Permanent live', function () {
  let servers: ServerInfo[] = []
  let videoUUID: string

  async function createLiveWrapper (permanentLive: boolean) {
    const attributes: LiveVideoCreate = {
      channelId: servers[0].videoChannel.id,
      privacy: VideoPrivacy.PUBLIC,
      name: 'my super live',
      saveReplay: false,
      permanentLive
    }

    const { uuid } = await servers[0].liveCommand.create({ fields: attributes })
    return uuid
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

    await servers[0].configCommand.updateCustomSubConfig({
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
      const live = await servers[0].liveCommand.get({ videoId: videoUUID })
      expect(live.permanentLive).to.be.false
    }

    await servers[0].liveCommand.update({ videoId: videoUUID, fields: { permanentLive: true } })

    {
      const live = await servers[0].liveCommand.get({ videoId: videoUUID })
      expect(live.permanentLive).to.be.true
    }
  })

  it('Should create a permanent live', async function () {
    this.timeout(20000)

    videoUUID = await createLiveWrapper(true)

    const live = await servers[0].liveCommand.get({ videoId: videoUUID })
    expect(live.permanentLive).to.be.true

    await waitJobs(servers)
  })

  it('Should stream into this permanent live', async function () {
    this.timeout(120000)

    const ffmpegCommand = await servers[0].liveCommand.sendRTMPStreamInVideo({ videoId: videoUUID })

    for (const server of servers) {
      await server.liveCommand.waitUntilPublished({ videoId: videoUUID })
    }

    await checkVideoState(videoUUID, VideoState.PUBLISHED)

    await stopFfmpeg(ffmpegCommand)
    await servers[0].liveCommand.waitUntilWaiting({ videoId: videoUUID })

    await waitJobs(servers)
  })

  it('Should not have cleaned up this live', async function () {
    this.timeout(40000)

    await wait(5000)
    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideo(server.url, videoUUID)

      const videoDetails = res.body as VideoDetails
      expect(videoDetails.streamingPlaylists).to.have.lengthOf(1)
    }
  })

  it('Should have set this live to waiting for live state', async function () {
    this.timeout(20000)

    await checkVideoState(videoUUID, VideoState.WAITING_FOR_LIVE)
  })

  it('Should be able to stream again in the permanent live', async function () {
    this.timeout(20000)

    await servers[0].configCommand.updateCustomSubConfig({
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

    const ffmpegCommand = await servers[0].liveCommand.sendRTMPStreamInVideo({ videoId: videoUUID })

    for (const server of servers) {
      await server.liveCommand.waitUntilPublished({ videoId: videoUUID })
    }

    await checkVideoState(videoUUID, VideoState.PUBLISHED)

    const count = await servers[0].liveCommand.countPlaylists({ videoUUID })
    // master playlist and 720p playlist
    expect(count).to.equal(2)

    await stopFfmpeg(ffmpegCommand)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
