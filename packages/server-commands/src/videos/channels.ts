import { arrayify } from '@peertube/peertube-core-utils'
import { PeerTubeServer } from '../server/server.js'

export function setDefaultVideoChannel (servers: PeerTubeServer[]) {
  const tasks: Promise<any>[] = []

  for (const server of servers) {
    const p = server.users.getMyInfo()
      .then(user => { server.store.channel = user.videoChannels[0] })

    tasks.push(p)
  }

  return Promise.all(tasks)
}

export async function setDefaultChannelAvatar (serversArg: PeerTubeServer | PeerTubeServer[], channelName: string = 'root_channel') {
  const servers = arrayify(serversArg)

  for (const server of servers) {
    await server.channels.updateImage({ channelName, fixture: 'avatar.png', type: 'avatar' })
  }
}
