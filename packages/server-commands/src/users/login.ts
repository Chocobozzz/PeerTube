import { PeerTubeServer } from '../server/server.js'

export function setAccessTokensToServers (servers: PeerTubeServer[]) {
  return Promise.all(
    servers.map(async server => {
      const token = await server.login.getAccessToken()

      server.accessToken = token
    })
  )
}
