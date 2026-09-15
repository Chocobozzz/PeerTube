/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { wait } from '@peertube/peertube-core-utils'
import { LiveVideoEventPayload, UserNotification, UserNotificationType } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSecondaryServer,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

async function waitUntil (condition: () => boolean, timeoutMS = 20000) {
  const start = Date.now()

  while (!condition()) {
    if (Date.now() - start > timeoutMS) throw new Error('Condition not met before timeout')

    await wait(250)
  }
}

describe('Test socket.io served by a secondary server process', function () {
  let primary: PeerTubeServer
  let secondary: PeerTubeServer
  let userToken: string
  let runnerToken: string

  before(async function () {
    this.timeout(120000)

    primary = await createSingleServer(1)

    await setAccessTokensToServers([ primary ])
    await setDefaultVideoChannel([ primary ])

    await primary.config.enableTranscoding({ hls: false, webVideo: true })
    await primary.config.enableRemoteTranscoding()
    runnerToken = await primary.runners.autoRegisterRunner()

    userToken = await primary.users.generateUserAndToken('user_socket')

    secondary = await createSecondaryServer(primary)
  })

  describe('User notifications', function () {

    it('Should reject an invalid access token on the secondary', function (done) {
      const socket = secondary.socketIO.getUserNotificationSocket({ token: 'invalid' })

      socket.on('connect_error', err => {
        expect(err.message).to.contain('Invalid access token')

        socket.close()
        done()
      })
    })

    it('Should deliver a notification created by the primary to a socket connected to the secondary', async function () {
      this.timeout(60000)

      const onSecondary: UserNotification[] = []
      const onPrimary: UserNotification[] = []

      const secondarySocket = secondary.socketIO.getUserNotificationSocket()
      secondarySocket.on('new-notification', n => onSecondary.push(n))

      const primarySocket = primary.socketIO.getUserNotificationSocket()
      primarySocket.on('new-notification', n => onPrimary.push(n))

      await waitUntil(() => secondarySocket.connected && primarySocket.connected)

      const { uuid } = await primary.videos.quickUpload({ name: 'video for notifications' })
      await waitJobs([ primary ])

      await primary.comments.createThread({ videoId: uuid, text: 'hello', token: userToken })

      const isCommentNotification = (n: UserNotification) => n.type === UserNotificationType.NEW_COMMENT_ON_MY_VIDEO

      await waitUntil(() => onSecondary.some(isCommentNotification) && onPrimary.some(isCommentNotification))

      // Every process receives the broadcast but must only deliver it to its own sockets, once
      await wait(1000)
      expect(onSecondary.filter(isCommentNotification)).to.have.lengthOf(1)
      expect(onPrimary.filter(isCommentNotification)).to.have.lengthOf(1)

      secondarySocket.close()
      primarySocket.close()
    })
  })

  describe('Live videos', function () {

    it('Should deliver viewer updates emitted by the primary to a socket connected to the secondary', async function () {
      this.timeout(60000)

      const { id, uuid } = await primary.videos.quickUpload({ name: 'video for viewers' })
      await waitJobs([ primary ])

      const events: LiveVideoEventPayload[] = []

      const socket = secondary.socketIO.getLiveNotificationSocket()
      socket.on('views-change', (payload: LiveVideoEventPayload) => events.push(payload))
      socket.emit('subscribe', { videoId: id })

      await waitUntil(() => socket.connected)

      // The viewer is registered by the secondary, but only the primary notifies clients
      await secondary.views.simulateViewer({ id: uuid, currentTimes: [ 1, 2 ] })

      await waitUntil(() => events.some(e => e.viewers === 1))

      socket.close()
    })
  })

  describe('Runners', function () {

    it('Should ping a runner connected to the secondary when the primary creates a job', async function () {
      this.timeout(60000)

      let pings = 0

      const socket = secondary.socketIO.getRunnersSocket({ runnerToken })
      socket.on('available-jobs', () => pings++)

      await waitUntil(() => socket.connected)

      await primary.videos.quickUpload({ name: 'video for runners' })
      await waitJobs([ primary ])

      await waitUntil(() => pings !== 0)

      socket.close()

      await primary.runnerJobs.cancelAllJobs()
    })
  })

  describe('Shutdown', function () {

    it('Should close the socket.io connections and not wait for them to stop the secondary', async function () {
      this.timeout(60000)

      const socket = secondary.socketIO.getRunnersSocket({ runnerToken })

      let disconnected = false
      socket.on('disconnect', () => {
        disconnected = true
      })

      await waitUntil(() => socket.connected)

      // Without closing them explicitly, the websockets would delay the shutdown until the global timeout of 8 seconds
      const start = Date.now()
      await secondary.kill()

      expect(Date.now() - start).to.be.below(6000)
      expect(disconnected).to.be.true
    })
  })

  after(async function () {
    await cleanupTests([ primary, secondary ])
  })
})
