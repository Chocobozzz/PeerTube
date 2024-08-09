import { Server as HTTPServer } from 'http'
import { Namespace, Server as SocketServer, Socket } from 'socket.io'
import { isIdValid } from '@server/helpers/custom-validators/misc.js'
import { Debounce } from '@server/helpers/debounce.js'
import { MVideo, MVideoImmutable } from '@server/types/models/index.js'
import { MRunner } from '@server/types/models/runners/index.js'
import { UserNotificationModelForApi } from '@server/types/models/user/index.js'
import { LiveVideoEventPayload, LiveVideoEventType } from '@peertube/peertube-models'
import { logger } from '../helpers/logger.js'
import { authenticateRunnerSocket, authenticateSocket } from '../middlewares/index.js'
import { isDevInstance } from '@peertube/peertube-node-utils'

class PeerTubeSocket {

  private static instance: PeerTubeSocket

  private userNotificationSockets: { [ userId: number ]: Socket[] } = {}
  private liveVideosNamespace: Namespace
  private readonly runnerSockets = new Set<Socket>()

  private constructor () {}

  init (server: HTTPServer) {
    const io = new SocketServer(server, {
      cors: isDevInstance()
        ? { origin: 'http://localhost:5173', methods: [ 'GET', 'POST' ] }
        : undefined
    })

    io.of('/user-notifications')
      .use(authenticateSocket)
      .on('connection', socket => {
        const userId = socket.handshake.auth.user.id

        logger.debug('User %d connected to the notification system.', userId)

        if (!this.userNotificationSockets[userId]) this.userNotificationSockets[userId] = []

        this.userNotificationSockets[userId].push(socket)

        socket.on('disconnect', () => {
          logger.debug('User %d disconnected from SocketIO notifications.', userId)

          this.userNotificationSockets[userId] = this.userNotificationSockets[userId].filter(s => s !== socket)
        })
      })

    this.liveVideosNamespace = io.of('/live-videos')
      .on('connection', socket => {
        socket.on('subscribe', params => {
          const videoId = params.videoId + ''
          if (!isIdValid(videoId)) return

          /* eslint-disable @typescript-eslint/no-floating-promises */
          socket.join(videoId)
        })

        socket.on('unsubscribe', params => {
          const videoId = params.videoId + ''
          if (!isIdValid(videoId)) return

          /* eslint-disable @typescript-eslint/no-floating-promises */
          socket.leave(videoId)
        })
      })

    io.of('/runners')
      .use(authenticateRunnerSocket)
      .on('connection', socket => {
        const runner: MRunner = socket.handshake.auth.runner

        logger.debug(`New runner "${runner.name}" connected to the notification system.`)

        this.runnerSockets.add(socket)

        socket.on('disconnect', () => {
          logger.debug(`Runner "${runner.name}" disconnected from the notification system.`)

          this.runnerSockets.delete(socket)
        })
      })
  }

  sendNotification (userId: number, notification: UserNotificationModelForApi) {
    const sockets = this.userNotificationSockets[userId]
    if (!sockets) return

    logger.debug('Sending user notification to user %d.', userId)

    const notificationMessage = notification.toFormattedJSON()
    for (const socket of sockets) {
      socket.emit('new-notification', notificationMessage)
    }
  }

  // ---------------------------------------------------------------------------

  sendVideoLiveNewState (video: MVideo) {
    const data: LiveVideoEventPayload = { state: video.state }
    const type: LiveVideoEventType = 'state-change'

    logger.debug('Sending video live new state notification of %s.', video.url, { state: video.state })

    this.liveVideosNamespace
      .in(video.id + '')
      .emit(type, data)
  }

  sendVideoViewsUpdate (video: MVideoImmutable, numViewers: number) {
    const data: LiveVideoEventPayload = { viewers: numViewers }
    const type: LiveVideoEventType = 'views-change'

    logger.debug('Sending video live views update notification of %s.', video.url, { viewers: numViewers })

    this.liveVideosNamespace
      .in(video.id + '')
      .emit(type, data)
  }

  sendVideoForceEnd (video: MVideo) {
    const type: LiveVideoEventType = 'force-end'

    logger.debug('Sending video live "force end" notification of %s.', video.url)

    this.liveVideosNamespace
      .in(video.id + '')
      .emit(type)
  }

  // ---------------------------------------------------------------------------

  @Debounce({ timeoutMS: 1000 })
  sendAvailableJobsPingToRunners () {
    logger.debug(`Sending available-jobs notification to ${this.runnerSockets.size} runner sockets`)

    for (const runners of this.runnerSockets) {
      runners.emit('available-jobs')
    }
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  PeerTubeSocket
}
