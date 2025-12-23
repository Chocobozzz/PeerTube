import { arrayify } from '@peertube/peertube-core-utils'
import { PeerTubeServer } from '../server/server.js'

export async function setDefaultAccountAvatar (serversArg: PeerTubeServer | PeerTubeServer[], token?: string) {
  const servers = arrayify(serversArg)

  return Promise.all(
    servers.map(s => s.users.updateMyAvatar({ fixture: 'avatar.png', token }))
  )
}
