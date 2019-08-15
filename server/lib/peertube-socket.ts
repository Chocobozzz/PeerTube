import * as SocketIO from 'socket.io'
import { authenticateSocket } from '../middlewares'
import { logger } from '../helpers/logger'
import { Server } from 'http'
import { UserNotificationModelForApi } from '@server/typings/models/user'

class PeerTubeSocket {

  private static instance: PeerTubeSocket

  private userNotificationSockets: { [ userId: number ]: SocketIO.Socket } = {}

  private constructor () {}

  init (server: Server) {
    const io = SocketIO(server)

    io.of('/user-notifications')
      .use(authenticateSocket)
      .on('connection', socket => {
        const userId = socket.handshake.query.user.id

        logger.debug('User %d connected on the notification system.', userId)

        this.userNotificationSockets[userId] = socket

        socket.on('disconnect', () => {
          logger.debug('User %d disconnected from SocketIO notifications.', userId)

          delete this.userNotificationSockets[userId]
        })
      })
  }

  sendNotification (userId: number, notification: UserNotificationModelForApi) {
    const socket = this.userNotificationSockets[userId]

    if (!socket) return

    socket.emit('new-notification', notification.toFormattedJSON())
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------

export {
  PeerTubeSocket
}
