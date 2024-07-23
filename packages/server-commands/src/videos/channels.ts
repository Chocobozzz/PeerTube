import { arrayify } from '@peertube/peertube-core-utils'
import { PeerTubeServer } from '../server/server.js'

export function setDefaultVideoChannel (servers: PeerTubeServer[]) {
  return Promise.all(
    servers.map(s => {
      return s.users.getMyInfo()
        .then(user => { s.store.channel = user.videoChannels[0] })
    })
  )
}

export async function setDefaultChannelAvatar (serversArg: PeerTubeServer | PeerTubeServer[], channelName: string = 'root_channel') {
  const servers = arrayify(serversArg)

  return Promise.all(
    servers.map(s => s.channels.updateImage({ channelName, fixture: 'avatar.png', type: 'avatar' }))
  )
}
