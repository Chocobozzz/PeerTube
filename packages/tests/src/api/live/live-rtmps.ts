/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { VideoPrivacy } from '@peertube/peertube-models'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  sendRTMPStream,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  testFfmpegStreamError,
  waitUntilLivePublishedOnAllServers
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test live RTMPS', function () {
  let server: PeerTubeServer
  let rtmpUrl: string
  let rtmpsUrl: string

  async function createLiveWrapper () {
    const liveAttributes = {
      name: 'live',
      channelId: server.store.channel.id,
      privacy: VideoPrivacy.PUBLIC,
      saveReplay: false
    }

    const { uuid } = await server.live.create({ fields: liveAttributes })

    const live = await server.live.get({ videoId: uuid })
    const video = await server.videos.get({ id: uuid })

    return Object.assign(video, live)
  }

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    // Get the access tokens
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await server.config.enableMinimumTranscoding()
    await server.config.enableLive({ allowReplay: true, transcoding: false })

    rtmpUrl = 'rtmp://' + server.hostname + ':' + server.rtmpPort + '/live'
    rtmpsUrl = 'rtmps://' + server.hostname + ':' + server.rtmpsPort + '/live'
  })

  it('Should enable RTMPS endpoint only', async function () {
    this.timeout(240000)

    await server.kill()
    await server.run({
      live: {
        rtmp: {
          enabled: false
        },
        rtmps: {
          enabled: true,
          port: server.rtmpsPort,
          key_file: buildAbsoluteFixturePath('rtmps.key'),
          cert_file: buildAbsoluteFixturePath('rtmps.cert')
        }
      }
    })

    {
      const liveVideo = await createLiveWrapper()

      expect(liveVideo.rtmpUrl).to.not.exist
      expect(liveVideo.rtmpsUrl).to.equal(rtmpsUrl)

      const command = sendRTMPStream({ rtmpBaseUrl: rtmpUrl, streamKey: liveVideo.streamKey })
      await testFfmpegStreamError(command, true)
    }

    {
      const liveVideo = await createLiveWrapper()

      const command = sendRTMPStream({ rtmpBaseUrl: rtmpsUrl, streamKey: liveVideo.streamKey })
      await waitUntilLivePublishedOnAllServers([ server ], liveVideo.uuid)
      await stopFfmpeg(command)
    }
  })

  it('Should enable both RTMP and RTMPS', async function () {
    this.timeout(240000)

    await server.kill()
    await server.run({
      live: {
        rtmp: {
          enabled: true,
          port: server.rtmpPort
        },
        rtmps: {
          enabled: true,
          port: server.rtmpsPort,
          key_file: buildAbsoluteFixturePath('rtmps.key'),
          cert_file: buildAbsoluteFixturePath('rtmps.cert')
        }
      }
    })

    {
      const liveVideo = await createLiveWrapper()

      expect(liveVideo.rtmpUrl).to.equal(rtmpUrl)
      expect(liveVideo.rtmpsUrl).to.equal(rtmpsUrl)

      const command = sendRTMPStream({ rtmpBaseUrl: rtmpUrl, streamKey: liveVideo.streamKey })
      await waitUntilLivePublishedOnAllServers([ server ], liveVideo.uuid)
      await stopFfmpeg(command)
    }

    {
      const liveVideo = await createLiveWrapper()

      const command = sendRTMPStream({ rtmpBaseUrl: rtmpsUrl, streamKey: liveVideo.streamKey })
      await waitUntilLivePublishedOnAllServers([ server ], liveVideo.uuid)
      await stopFfmpeg(command)
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
