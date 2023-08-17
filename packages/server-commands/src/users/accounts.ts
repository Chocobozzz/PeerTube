import { PeerTubeServer } from '../server/server.js'

async function setDefaultAccountAvatar (serversArg: PeerTubeServer | PeerTubeServer[], token?: string) {
  const servers = Array.isArray(serversArg)
    ? serversArg
    : [ serversArg ]

  for (const server of servers) {
    await server.users.updateMyAvatar({ fixture: 'avatar.png', token })
  }
}

export {
  setDefaultAccountAvatar
}
