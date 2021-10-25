/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { VideoPrivacy, VideoState } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  wait,
  waitJobs,
  waitUntilLivePublishedOnAllServers
} from '../../../../shared/extra-utils'

const expect = chai.expect

describe('Test live', function () {
  let servers: PeerTubeServer[] = []

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await servers[0].config.updateCustomSubConfig({
      newConfig: {
        live: {
          enabled: true,
          allowReplay: true,
          transcoding: {
            enabled: false
          }
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
        channelId: servers[0].store.channel.id,
        privacy: VideoPrivacy.PUBLIC
      }

      const { uuid } = await servers[0].live.create({ fields: liveAttributes })
      return uuid
    }

    it('Should correctly send a message when the live starts and ends', async function () {
      this.timeout(60000)

      const localStateChanges: VideoState[] = []
      const remoteStateChanges: VideoState[] = []

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

      for (const stateChanges of [ localStateChanges, remoteStateChanges ]) {
        expect(stateChanges).to.have.length.at.least(1)
        expect(stateChanges[stateChanges.length - 1]).to.equal(VideoState.PUBLISHED)
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
        localSocket.on('views-change', data => { localLastVideoViews = data.views })
        localSocket.emit('subscribe', { videoId })
      }

      {
        const videoId = await servers[1].videos.getId({ uuid: liveVideoUUID })

        const remoteSocket = servers[1].socketIO.getLiveNotificationSocket()
        remoteSocket.on('views-change', data => { remoteLastVideoViews = data.views })
        remoteSocket.emit('subscribe', { videoId })
      }

      const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: liveVideoUUID })

      await waitUntilLivePublishedOnAllServers(servers, liveVideoUUID)
      await waitJobs(servers)

      expect(localLastVideoViews).to.equal(0)
      expect(remoteLastVideoViews).to.equal(0)

      await servers[0].videos.view({ id: liveVideoUUID })
      await servers[1].videos.view({ id: liveVideoUUID })

      await waitJobs(servers)
      await wait(5000)
      await waitJobs(servers)

      expect(localLastVideoViews).to.equal(2)
      expect(remoteLastVideoViews).to.equal(2)

      await stopFfmpeg(ffmpegCommand)
    })

    it('Should not receive a notification after unsubscribe', async function () {
      this.timeout(120000)

      const stateChanges: VideoState[] = []

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
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
