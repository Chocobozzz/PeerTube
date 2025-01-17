/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { LiveVideoCreate, LiveVideoEventPayload, VideoPrivacy, VideoState, VideoStateType } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs,
  waitUntilLivePublishedOnAllServers
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test live socket messages', function () {
  let servers: PeerTubeServer[] = []

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await servers[0].config.enableMinimumTranscoding()
    await servers[0].config.enableLive({ allowReplay: true, transcoding: false })

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  describe('Live socket messages', function () {

    async function createLiveWrapper (options: Partial<LiveVideoCreate> = {}) {
      const liveAttributes = {
        name: 'live video',
        channelId: servers[0].store.channel.id,
        privacy: VideoPrivacy.PUBLIC,

        ...options
      }

      const { uuid } = await servers[0].live.create({ fields: liveAttributes })
      return uuid
    }

    it('Should correctly send a message when the live starts and ends', async function () {
      this.timeout(60000)

      const localStateChanges: VideoStateType[] = []
      const remoteStateChanges: VideoStateType[] = []

      const liveVideoUUID = await createLiveWrapper()
      await waitJobs(servers)

      {
        const videoId = await servers[0].videos.getId({ uuid: liveVideoUUID })

        const localSocket = servers[0].socketIO.getLiveNotificationSocket()
        localSocket.on('state-change', data => localStateChanges.push(data.state))
        localSocket.emit('subscribe', { videoId })
      }

      {
        const videoId = await servers[1].videos.getId({ uuid: liveVideoUUID })

        const remoteSocket = servers[1].socketIO.getLiveNotificationSocket()
        remoteSocket.on('state-change', data => remoteStateChanges.push(data.state))
        remoteSocket.emit('subscribe', { videoId })
      }

      const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: liveVideoUUID })

      await waitUntilLivePublishedOnAllServers(servers, liveVideoUUID)
      await waitJobs(servers)

      // Ensure remote server doesn't send multiple times the state change event to viewers
      await servers[0].videos.update({ id: liveVideoUUID, attributes: { name: 'my new live name' } })
      await waitJobs(servers)

      for (const stateChanges of [ localStateChanges, remoteStateChanges ]) {
        expect(stateChanges).to.have.lengthOf(1)
        expect(stateChanges[0]).to.equal(VideoState.PUBLISHED)
      }

      await stopFfmpeg(ffmpegCommand)

      for (const server of servers) {
        await server.live.waitUntilEnded({ videoId: liveVideoUUID })
      }
      await waitJobs(servers)

      for (const stateChanges of [ localStateChanges, remoteStateChanges ]) {
        expect(stateChanges).to.have.length.at.least(2)
        expect(stateChanges[stateChanges.length - 1]).to.equal(VideoState.LIVE_ENDED)
      }
    })

    it('Should correctly send views change notification', async function () {
      this.timeout(60000)

      let localLastVideoViews = 0
      let remoteLastVideoViews = 0

      const liveVideoUUID = await createLiveWrapper()
      await waitJobs(servers)

      {
        const videoId = await servers[0].videos.getId({ uuid: liveVideoUUID })

        const localSocket = servers[0].socketIO.getLiveNotificationSocket()
        localSocket.on('views-change', (data: LiveVideoEventPayload) => { localLastVideoViews = data.viewers })
        localSocket.emit('subscribe', { videoId })
      }

      {
        const videoId = await servers[1].videos.getId({ uuid: liveVideoUUID })

        const remoteSocket = servers[1].socketIO.getLiveNotificationSocket()
        remoteSocket.on('views-change', (data: LiveVideoEventPayload) => { remoteLastVideoViews = data.viewers })
        remoteSocket.emit('subscribe', { videoId })
      }

      const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: liveVideoUUID })

      await waitUntilLivePublishedOnAllServers(servers, liveVideoUUID)
      await waitJobs(servers)

      expect(localLastVideoViews).to.equal(0)
      expect(remoteLastVideoViews).to.equal(0)

      const interval = setInterval(async () => {
        try {
          await servers[0].views.simulateView({ id: liveVideoUUID, sessionId: 'session1' })
          await servers[1].views.simulateView({ id: liveVideoUUID, sessionId: 'session2' })
        } catch (err) {
          console.error('Cannot simulate view', err)
        }
      }, 1000)

      await wait(6000)
      await waitJobs(servers)

      expect(localLastVideoViews).to.equal(2)
      expect(remoteLastVideoViews).to.equal(2)

      clearInterval(interval)
      await stopFfmpeg(ffmpegCommand)
    })

    it('Should not receive a notification after unsubscribe', async function () {
      this.timeout(120000)

      const stateChanges: VideoStateType[] = []

      const liveVideoUUID = await createLiveWrapper()
      await waitJobs(servers)

      const videoId = await servers[0].videos.getId({ uuid: liveVideoUUID })

      const socket = servers[0].socketIO.getLiveNotificationSocket()
      socket.on('state-change', data => stateChanges.push(data.state))
      socket.emit('subscribe', { videoId })

      const command = await servers[0].live.sendRTMPStreamInVideo({ videoId: liveVideoUUID })

      await waitUntilLivePublishedOnAllServers(servers, liveVideoUUID)
      await waitJobs(servers)

      // Notifier waits before sending a notification
      await wait(10000)

      expect(stateChanges).to.have.lengthOf(1)
      socket.emit('unsubscribe', { videoId })

      await stopFfmpeg(command)
      await waitJobs(servers)

      expect(stateChanges).to.have.lengthOf(1)
    })

    it('Should correctly send a force end notification', async function () {
      this.timeout(60000)

      let hadForcedEndEvent = false

      await servers[0].kill()

      const env = { PEERTUBE_TEST_CONSTANTS_VIDEO_LIVE_CLEANUP_DELAY: '20000' }
      await servers[0].run({}, { env })

      const liveVideoUUID = await createLiveWrapper({ permanentLive: true })

      {
        const videoId = await servers[0].videos.getId({ uuid: liveVideoUUID })

        const localSocket = servers[0].socketIO.getLiveNotificationSocket()
        localSocket.on('force-end', () => { hadForcedEndEvent = true })
        localSocket.emit('subscribe', { videoId })
      }

      // Streaming session #1
      const rtmpOptions = {
        videoId: liveVideoUUID,
        copyCodecs: true,
        fixtureName: 'video_short.mp4'
      }

      let ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo(rtmpOptions)
      await servers[0].live.waitUntilPublished({ videoId: liveVideoUUID })

      await stopFfmpeg(ffmpegCommand)
      await servers[0].live.waitUntilWaiting({ videoId: liveVideoUUID })

      // Streaming session #2
      ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo(rtmpOptions)

      // eslint-disable-next-line no-unmodified-loop-condition
      while (!hadForcedEndEvent) {
        await wait(500)
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
