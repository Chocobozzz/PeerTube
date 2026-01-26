import { io } from 'socket.io-client'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class SocketIOCommand extends AbstractCommand {
  getUserNotificationSocket (options: OverrideCommandOptions = {}): ReturnType<typeof io> {
    return io(this.server.url + '/user-notifications', {
      query: { accessToken: options.token ?? this.server.accessToken }
    })
  }

  getLiveNotificationSocket (): ReturnType<typeof io> {
    return io(this.server.url + '/live-videos')
  }

  getRunnersSocket (options: {
    runnerToken: string
  }): ReturnType<typeof io> {
    return io(this.server.url + '/runners', {
      reconnection: false,
      auth: { runnerToken: options.runnerToken }
    })
  }
}
