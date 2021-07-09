import { User } from '../../models/users/user.model'
import { ServerInfo } from '../server/servers'
import { getMyUserInformation } from '../users/users'

function setDefaultVideoChannel (servers: ServerInfo[]) {
  const tasks: Promise<any>[] = []

  for (const server of servers) {
    const p = getMyUserInformation(server.url, server.accessToken)
      .then(res => { server.videoChannel = (res.body as User).videoChannels[0] })

    tasks.push(p)
  }

  return Promise.all(tasks)
}

export {
  setDefaultVideoChannel
}
