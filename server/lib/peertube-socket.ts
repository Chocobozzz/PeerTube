import { Server as HTTPServer } from 'http'
import { Namespace, Server as SocketServer, Socket } from 'socket.io'
import { isIdValid } from '@server/helpers/custom-validators/misc'
import { MVideo, MVideoImmutable } from '@server/types/models'
import { UserNotificationModelForApi } from '@server/types/models/user'
import { LiveVideoEventPayload, LiveVideoEventType } from '@shared/models'
import { logger } from '../helpers/logger'
import { authenticateSocket } from '../middlewares'

class PeerTubeSocket {

  private static instance: PeerTubeSocket

  private userNotificationSockets: { [ userId: number ]: Socket[] } = {}
  private liveVideosNamespace: Namespace

  private constructor () {}

  init (server: HTTPServer) {
    const io = new SocketServer(server)

    io.of('/user-notifications')
      .use(authenticateSocket)
      .on('connection', socket => {
        const userId = socket.handshake.auth.user.id

        logger.debug('User %d connected on the notification system.', userId)

        if (!this.userNotificationSockets[userId]) this.userNotificationSockets[userId] = []

        this.userNotificationSockets[userId].push(socket)

        socket.on('disconnect', () => {
          logger.debug('User %d disconnected from SocketIO notifications.', userId)

          this.userNotificationSockets[userId] = this.userNotificationSockets[userId].filter(s => s !== socket)
        })
      })

    this.liveVideosNamespace = io.of('/live-videos')
      .on('connection', socket => {
        socket.on('subscribe', ({ videoId }) => {
          if (!isIdValid(videoId)) return

          /* eslint-disable @typescript-eslint/no-floating-promises */
          socket.join(videoId)
        })

        socket.on('unsubscribe', ({ videoId }) => {
          if (!isIdValid(videoId)) return

          /* eslint-disable @typescript-eslint/no-floating-promises */
          socket.leave(videoId)
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

  sendVideoLiveNewState (video: MVideo) {
    const data: LiveVideoEventPayload = { state: video.state }
    const type: LiveVideoEventType = 'state-change'

    logger.debug('Sending video live new state notification of %s.', video.url, { state: video.state })

    this.liveVideosNamespace
      .in(video.id)
      .emit(type, data)
  }

  sendVideoViewsUpdate (video: MVideoImmutable, numViewers: number) {
    const data: LiveVideoEventPayload = { viewers: numViewers, views: numViewers }
    const type: LiveVideoEventType = 'views-change'

    logger.debug('Sending video live views update notification of %s.', video.url, { viewers: numViewers })

    this.liveVideosNamespace
      .in(video.id)
      .emit(type, data)
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  PeerTubeSocket
}
