/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { LiveVideoCreate, VideoDetails, VideoPrivacy, VideoState } from '@shared/models'
import {
  cleanupTests,
  createLive,
  doubleFollow,
  flushAndRunMultipleServers,
  getLive,
  getPlaylistsCount,
  getVideo,
  sendRTMPStreamInVideo,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  updateCustomSubConfig,
  updateLive,
  wait,
  waitJobs,
  waitUntilLivePublished,
  waitUntilLiveWaiting
} from '../../../../shared/extra-utils'

const expect = chai.expect

describe('Permenant live', function () {
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

    const res = await createLive(servers[0].url, servers[0].accessToken, attributes)
    return res.body.video.uuid
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
  })

  it('Should create a non permanent live and update it to be a permanent live', async function () {
    this.timeout(20000)

    const videoUUID = await createLiveWrapper(false)

    {
      const res = await getLive(servers[0].url, servers[0].accessToken, videoUUID)
      expect(res.body.permanentLive).to.be.false
    }

    await updateLive(servers[0].url, servers[0].accessToken, videoUUID, { permanentLive: true })

    {
      const res = await getLive(servers[0].url, servers[0].accessToken, videoUUID)
      expect(res.body.permanentLive).to.be.true
    }
  })

  it('Should create a permanent live', async function () {
    this.timeout(20000)

    videoUUID = await createLiveWrapper(true)

    const res = await getLive(servers[0].url, servers[0].accessToken, videoUUID)
    expect(res.body.permanentLive).to.be.true

    await waitJobs(servers)
  })

  it('Should stream into this permanent live', async function () {
    this.timeout(60000)

    const command = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, videoUUID)

    for (const server of servers) {
      await waitUntilLivePublished(server.url, server.accessToken, videoUUID)
    }

    await checkVideoState(videoUUID, VideoState.PUBLISHED)

    await stopFfmpeg(command)
    await waitUntilLiveWaiting(servers[0].url, servers[0].accessToken, videoUUID)

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

    await updateCustomSubConfig(servers[0].url, servers[0].accessToken, {
      live: {
        enabled: true,
        allowReplay: true,
        maxDuration: -1,
        transcoding: {
          enabled: true,
          resolutions: {
            '240p': false,
            '360p': false,
            '480p': false,
            '720p': false,
            '1080p': false,
            '1440p': false,
            '2160p': false
          }
        }
      }
    })

    const command = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, videoUUID)

    for (const server of servers) {
      await waitUntilLivePublished(server.url, server.accessToken, videoUUID)
    }

    await checkVideoState(videoUUID, VideoState.PUBLISHED)

    const count = await getPlaylistsCount(servers[0], videoUUID)
    // master playlist and 720p playlist
    expect(count).to.equal(2)

    await stopFfmpeg(command)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
