/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { getLiveNotificationSocket } from '@shared/extra-utils/socket/socket-io'
import { VideoPrivacy, VideoState } from '@shared/models'
import {
  cleanupTests,
  createLive,
  doubleFollow,
  flushAndRunMultipleServers,
  getVideoIdFromUUID,
  sendRTMPStreamInVideo,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  updateCustomSubConfig,
  viewVideo,
  wait,
  waitJobs,
  waitUntilLiveEnded,
  waitUntilLivePublishedOnAllServers
} from '../../../../shared/extra-utils'

const expect = chai.expect

describe('Test live', function () {
  let servers: ServerInfo[] = []

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

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  describe('Live socket messages', function () {

    async function createLiveWrapper () {
      const liveAttributes = {
        name: 'live video',
        channelId: servers[0].videoChannel.id,
        privacy: VideoPrivacy.PUBLIC
      }

      const res = await createLive(servers[0].url, servers[0].accessToken, liveAttributes)
      return res.body.video.uuid
    }

    it('Should correctly send a message when the live starts and ends', async function () {
      this.timeout(60000)

      const localStateChanges: VideoState[] = []
      const remoteStateChanges: VideoState[] = []

      const liveVideoUUID = await createLiveWrapper()
      await waitJobs(servers)

      {
        const videoId = await getVideoIdFromUUID(servers[0].url, liveVideoUUID)

        const localSocket = getLiveNotificationSocket(servers[0].url)
        localSocket.on('state-change', data => localStateChanges.push(data.state))
        localSocket.emit('subscribe', { videoId })
      }

      {
        const videoId = await getVideoIdFromUUID(servers[1].url, liveVideoUUID)

        const remoteSocket = getLiveNotificationSocket(servers[1].url)
        remoteSocket.on('state-change', data => remoteStateChanges.push(data.state))
        remoteSocket.emit('subscribe', { videoId })
      }

      const command = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoUUID)

      await waitUntilLivePublishedOnAllServers(servers, liveVideoUUID)
      await waitJobs(servers)

      for (const stateChanges of [ localStateChanges, remoteStateChanges ]) {
        expect(stateChanges).to.have.length.at.least(1)
        expect(stateChanges[stateChanges.length - 1]).to.equal(VideoState.PUBLISHED)
      }

      await stopFfmpeg(command)

      for (const server of servers) {
        await waitUntilLiveEnded(server.url, server.accessToken, liveVideoUUID)
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
        const videoId = await getVideoIdFromUUID(servers[0].url, liveVideoUUID)

        const localSocket = getLiveNotificationSocket(servers[0].url)
        localSocket.on('views-change', data => { localLastVideoViews = data.views })
        localSocket.emit('subscribe', { videoId })
      }

      {
        const videoId = await getVideoIdFromUUID(servers[1].url, liveVideoUUID)

        const remoteSocket = getLiveNotificationSocket(servers[1].url)
        remoteSocket.on('views-change', data => { remoteLastVideoViews = data.views })
        remoteSocket.emit('subscribe', { videoId })
      }

      const command = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoUUID)

      await waitUntilLivePublishedOnAllServers(servers, liveVideoUUID)
      await waitJobs(servers)

      expect(localLastVideoViews).to.equal(0)
      expect(remoteLastVideoViews).to.equal(0)

      await viewVideo(servers[0].url, liveVideoUUID)
      await viewVideo(servers[1].url, liveVideoUUID)

      await waitJobs(servers)
      await wait(5000)
      await waitJobs(servers)

      expect(localLastVideoViews).to.equal(2)
      expect(remoteLastVideoViews).to.equal(2)

      await stopFfmpeg(command)
    })

    it('Should not receive a notification after unsubscribe', async function () {
      this.timeout(120000)

      const stateChanges: VideoState[] = []

      const liveVideoUUID = await createLiveWrapper()
      await waitJobs(servers)

      const videoId = await getVideoIdFromUUID(servers[0].url, liveVideoUUID)

      const socket = getLiveNotificationSocket(servers[0].url)
      socket.on('state-change', data => stateChanges.push(data.state))
      socket.emit('subscribe', { videoId })

      const command = await sendRTMPStreamInVideo(servers[0].url, servers[0].accessToken, liveVideoUUID)

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
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
