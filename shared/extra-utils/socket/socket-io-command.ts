import { io } from 'socket.io-client'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

export class SocketIOCommand extends AbstractCommand {

  getUserNotificationSocket (options: OverrideCommandOptions = {}) {
    return io(this.server.url + '/user-notifications', {
      query: { accessToken: options.token ?? this.server.accessToken }
    })
  }

  getLiveNotificationSocket () {
    return io(this.server.url + '/live-videos')
  }
}
