import * as SocketIO from 'socket.io'
import { authenticateSocket } from '../middlewares'
import { UserNotificationModel } from '../models/account/user-notification'
import { logger } from '../helpers/logger'
import { Server } from 'http'

class PeerTubeSocket {

  private static instance: PeerTubeSocket

  private userNotificationSockets: { [ userId: number ]: SocketIO.Socket[] } = {}

  private constructor () {}

  init (server: Server) {
    const io = SocketIO(server)

    io.of('/user-notifications')
      .use(authenticateSocket)
      .on('connection', socket => {
        const userId = socket.handshake.query.user.id

        logger.debug('User %d connected on the notification system.', userId)

        if (!this.userNotificationSockets[userId]) this.userNotificationSockets[userId] = []

        this.userNotificationSockets[userId].push(socket)

        socket.on('disconnect', () => {
          logger.debug('User %d disconnected from SocketIO notifications.', userId)

          this.userNotificationSockets[userId] = this.userNotificationSockets[userId].filter(s => s !== socket)
        })
      })
  }

  sendNotification (userId: number, notification: UserNotificationModel) {
    const sockets = this.userNotificationSockets[userId]

    if (!sockets) return

    for (const socket of sockets) {
      socket.emit('new-notification', notification.toFormattedJSON())
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
