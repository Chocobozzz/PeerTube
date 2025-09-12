/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { VideoCreateResult } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test player settings', function () {
  let servers: PeerTubeServer[]
  let video: VideoCreateResult
  let otherVideo: VideoCreateResult
  let otherVideoAndChannel: VideoCreateResult

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(60000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    video = await servers[0].videos.upload()
    otherVideo = await servers[0].videos.upload()

    const otherChannel = await servers[0].channels.create({ attributes: { name: 'other_channel' } })
    otherVideoAndChannel = await servers[0].videos.upload({ attributes: { channelId: otherChannel.id } })

    await doubleFollow(servers[0], servers[1])
  })

  async function check (options: {
    server: PeerTubeServer
    videoId: number | string
    channelHandle: string
    expectedVideo: string
    expectedChannel: string
    expectedRawVideo?: string
    expectedRawChannel?: string
  }) {
    const { server, expectedRawVideo, expectedRawChannel, expectedVideo, expectedChannel } = options

    // Raw mode
    {
      if (expectedRawVideo) {
        const { theme } = await server.playerSettings.getForVideo({
          token: server.accessToken,
          videoId: options.videoId,
          raw: true
        })
        expect(theme).to.equal(expectedRawVideo)
      }

      if (expectedRawChannel) {
        const { theme } = await server.playerSettings.getForChannel({
          token: server.accessToken,
          channelHandle: options.channelHandle,
          raw: true
        })
        expect(theme).to.equal(expectedRawChannel)
      }
    }

    // Interpreted settings mode
    {
      {
        const { theme } = await server.playerSettings.getForVideo({ videoId: options.videoId })
        expect(theme).to.equal(expectedVideo)
      }

      {
        const { theme } = await server.playerSettings.getForChannel({ channelHandle: options.channelHandle, raw: false })
        expect(theme).to.equal(expectedChannel)
      }
    }
  }

  it('Should return default player settings for the instance', async function () {
    await check({
      server: servers[0],
      videoId: video.uuid,
      channelHandle: 'root_channel',
      expectedRawVideo: 'channel-default',
      expectedRawChannel: 'instance-default',
      expectedVideo: 'galaxy',
      expectedChannel: 'galaxy'
    })

    await check({
      server: servers[1],
      videoId: video.uuid,
      channelHandle: 'root_channel@' + servers[0].host,
      expectedVideo: 'galaxy',
      expectedChannel: 'galaxy'
    })
  })

  it('Should update instance settings and return the updated settings', async function () {
    await servers[0].config.updateExistingConfig({ newConfig: { defaults: { player: { theme: 'lucide' } } } })

    await check({
      server: servers[0],
      videoId: video.uuid,
      channelHandle: 'root_channel',
      expectedRawVideo: 'channel-default',
      expectedRawChannel: 'instance-default',
      expectedVideo: 'lucide',
      expectedChannel: 'lucide'
    })

    // Instance 2 keeps its own instance default
    await check({
      server: servers[1],
      videoId: video.uuid,
      channelHandle: 'root_channel@' + servers[0].host,
      expectedVideo: 'galaxy',
      expectedChannel: 'galaxy'
    })

    // Update instance 2 default theme to observe changes
    await servers[1].config.updateExistingConfig({ newConfig: { defaults: { player: { theme: 'lucide' } } } })

    await check({
      server: servers[1],
      videoId: video.uuid,
      channelHandle: 'root_channel@' + servers[0].host,
      expectedVideo: 'lucide',
      expectedChannel: 'lucide'
    })
  })

  it('Should update player settings of the channel and return the updated settings', async function () {
    const { theme } = await servers[0].playerSettings.updateForChannel({ channelHandle: 'root_channel', theme: 'galaxy' })
    expect(theme).to.equal('galaxy')

    await waitJobs(servers)

    await check({
      server: servers[0],
      videoId: video.uuid,
      channelHandle: 'root_channel',
      expectedRawVideo: 'channel-default',
      expectedRawChannel: 'galaxy',
      expectedVideo: 'galaxy',
      expectedChannel: 'galaxy'
    })

    await check({
      server: servers[1],
      videoId: video.uuid,
      channelHandle: 'root_channel@' + servers[0].host,
      expectedVideo: 'galaxy',
      expectedChannel: 'galaxy'
    })
  })

  it('Should update player settings of the video and return the updated settings', async function () {
    const { theme } = await servers[0].playerSettings.updateForVideo({ videoId: video.id, theme: 'lucide' })
    expect(theme).to.equal('lucide')

    await waitJobs(servers)

    await check({
      server: servers[0],
      videoId: video.uuid,
      channelHandle: 'root_channel',
      expectedRawVideo: 'lucide',
      expectedRawChannel: 'galaxy',
      expectedVideo: 'lucide',
      expectedChannel: 'galaxy'
    })

    await check({
      server: servers[1],
      videoId: video.uuid,
      channelHandle: 'root_channel@' + servers[0].host,
      expectedVideo: 'lucide',
      expectedChannel: 'galaxy'
    })
  })

  it('Should choose the default instance player theme', async function () {
    const { theme } = await servers[0].playerSettings.updateForVideo({ videoId: video.id, theme: 'instance-default' })
    expect(theme).to.equal('instance-default')

    await waitJobs(servers)

    await check({
      server: servers[0],
      videoId: video.uuid,
      channelHandle: 'root_channel',
      expectedRawVideo: 'instance-default',
      expectedRawChannel: 'galaxy',
      expectedVideo: 'lucide',
      expectedChannel: 'galaxy'
    })

    await check({
      server: servers[1],
      videoId: video.uuid,
      channelHandle: 'root_channel@' + servers[0].host,
      expectedVideo: 'lucide',
      expectedChannel: 'galaxy'
    })
  })

  it('Should choose the default channel player theme', async function () {
    const { theme } = await servers[0].playerSettings.updateForVideo({ videoId: video.id, theme: 'channel-default' })
    expect(theme).to.equal('channel-default')

    await waitJobs(servers)

    await check({
      server: servers[0],
      videoId: video.uuid,
      channelHandle: 'root_channel',
      expectedRawVideo: 'channel-default',
      expectedRawChannel: 'galaxy',
      expectedVideo: 'galaxy',
      expectedChannel: 'galaxy'
    })

    await check({
      server: servers[1],
      videoId: video.uuid,
      channelHandle: 'root_channel@' + servers[0].host,
      expectedVideo: 'galaxy',
      expectedChannel: 'galaxy'
    })
  })

  it('Should keep default settings for the other video', async function () {
    await check({
      server: servers[0],
      videoId: otherVideo.uuid,
      channelHandle: 'root_channel',
      expectedRawVideo: 'channel-default',
      expectedRawChannel: 'galaxy',
      expectedVideo: 'galaxy',
      expectedChannel: 'galaxy'
    })

    await check({
      server: servers[1],
      videoId: otherVideo.uuid,
      channelHandle: 'root_channel@' + servers[0].host,
      expectedVideo: 'galaxy',
      expectedChannel: 'galaxy'
    })
  })

  it('Should keep default settings for the other channel', async function () {
    await check({
      server: servers[0],
      videoId: otherVideoAndChannel.uuid,
      channelHandle: 'other_channel',
      expectedRawVideo: 'channel-default',
      expectedRawChannel: 'instance-default',
      expectedVideo: 'lucide',
      expectedChannel: 'lucide'
    })

    await check({
      server: servers[1],
      videoId: otherVideoAndChannel.uuid,
      channelHandle: 'other_channel@' + servers[0].host,
      expectedVideo: 'lucide',
      expectedChannel: 'lucide'
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
