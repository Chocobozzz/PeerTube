/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Publisher disconnecting while the live is being set up', function () {
  let server: PeerTubeServer

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await server.config.enableLive({ allowReplay: false, transcoding: false })

    // Slows down the live setup after the RTMP stream has been probed
    await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-slow-live-setup') })
  })

  it('Should accept a new stream after the publisher disconnected during the live setup', async function () {
    this.timeout(240000)

    const { uuid: liveVideoUUID } = await server.live.create({
      fields: {
        channelId: server.store.channel.id,
        privacy: VideoPrivacy.PUBLIC,
        name: 'permanent live',
        saveReplay: false,
        permanentLive: true
      }
    })
    await waitJobs([ server ])

    const rtmpOptions = { videoId: liveVideoUUID, copyCodecs: true }

    // The publisher disconnects before the live session starts
    {
      const ffmpegCommand = await server.live.sendRTMPStreamInVideo(rtmpOptions)

      await server.servers.waitUntilLog('Slowing down live setup of ' + liveVideoUUID, 1)
      await stopFfmpeg(ffmpegCommand)

      await server.servers.waitUntilLog('Slowed down live setup of ' + liveVideoUUID, 1)
    }

    // The new stream must work, nor be hijacked by its transcoding process
    {
      const ffmpegCommand = await server.live.sendRTMPStreamInVideo(rtmpOptions)

      let streamError: Error
      ffmpegCommand.on('error', err => {
        streamError = err
      })

      await server.live.waitUntilPublished({ videoId: liveVideoUUID })
      await server.live.waitUntilSegmentGeneration({ server, videoUUID: liveVideoUUID, segment: 2, playlistNumber: 0 })

      expect(streamError).to.not.exist

      await stopFfmpeg(ffmpegCommand)
      await server.live.waitUntilWaiting({ videoId: liveVideoUUID })
    }

    await waitJobs([ server ])

    const { total, data } = await server.live.listSessions({ videoId: liveVideoUUID })
    expect(total).to.equal(1)
    expect(data[0].error).to.be.null
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
