import { LiveVideoEventPayload, LiveVideoEventType } from '@peertube/peertube-models'
import { isDevInstance } from '@peertube/peertube-node-utils'
import { isIdValid } from '@server/helpers/custom-validators/misc.js'
import { Debounce } from '@server/helpers/debounce.js'
import { Redis } from '@server/lib/redis/index.js'
import { MVideo, MVideoImmutable } from '@server/types/models/index.js'
import { MRunner } from '@server/types/models/runners/index.js'
import { UserNotificationModelForApi } from '@server/types/models/user/index.js'
import { createAdapter } from '@socket.io/redis-adapter'
import { Server as HTTPServer } from 'http'
import { Namespace, Server as SocketServer } from 'socket.io'
import { createLogger } from '../helpers/logger.js'
import { authenticateRunnerSocket, authenticateSocket } from '../middlewares/index.js'

const logger = createLogger()

const RUNNERS_ROOM = 'runners'

class PeerTubeSocket {
  private static instance: PeerTubeSocket

  private userNotificationsNamespace: Namespace
  private liveVideosNamespace: Namespace
  private runnersNamespace: Namespace

  private constructor () {}

  init (server: HTTPServer) {
    const io = new SocketServer(server, {
      cors: isDevInstance()
        ? { origin: 'http://localhost:5173', methods: [ 'GET', 'POST' ] }
        : undefined
    })

    // Broadcast to all socket.io instances if spawning multiple PeerTube processes
    // Both are closed with the main Redis client when PeerTube shuts down
    const pubClient = Redis.Instance.duplicateClient('socket.io pub')
    const subClient = Redis.Instance.duplicateClient('socket.io sub')

    io.adapter(createAdapter(pubClient, subClient, { key: Redis.Instance.getPrefix() + 'socket.io' }))

    this.userNotificationsNamespace = io.of('/user-notifications')
      .use(authenticateSocket)
      .on('connection', socket => {
        const userId = socket.handshake.auth.user.id

        logger.debug('User %d connected to the notification system.', userId)

        void socket.join(this.buildUserRoom(userId))

        socket.on('disconnect', () => {
          logger.debug('User %d disconnected from SocketIO notifications.', userId)
        })
      })

    this.liveVideosNamespace = io.of('/live-videos')
      .on('connection', socket => {
        socket.on('subscribe', params => {
          const videoId = params.videoId + ''
          if (!isIdValid(videoId)) return

          void socket.join(videoId)
        })

        socket.on('unsubscribe', params => {
          const videoId = params.videoId + ''
          if (!isIdValid(videoId)) return

          void socket.leave(videoId)
        })
      })

    this.runnersNamespace = io.of('/runners')
      .use(authenticateRunnerSocket)
      .on('connection', socket => {
        const runner: MRunner = socket.handshake.auth.runner

        logger.debug(`New runner "${runner.name}" connected to the notification system.`)

        void socket.join(RUNNERS_ROOM)

        socket.on('disconnect', () => {
          logger.debug(`Runner "${runner.name}" disconnected from the notification system.`)
        })
      })
  }

  sendNotification (userId: number, notification: UserNotificationModelForApi) {
    // The socket server may never be started in this process
    if (!this.userNotificationsNamespace) return

    logger.debug('Sending user notification to user %d.', userId)

    const notificationMessage = notification.toFormattedJSON()

    this.userNotificationsNamespace
      .in(this.buildUserRoom(userId))
      .emit('new-notification', notificationMessage)
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
    // The socket server may never be started in this process (a job-only or secondary process)
    if (!this.runnersNamespace) return

    logger.debug('Sending available-jobs notification to runner sockets')

    this.runnersNamespace
      .in(RUNNERS_ROOM)
      .emit('available-jobs')
  }

  private buildUserRoom (userId: number) {
    return 'user-' + userId
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  PeerTubeSocket
}
