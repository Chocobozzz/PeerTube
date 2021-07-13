import { ServerInfo } from '../server/servers'

function setDefaultVideoChannel (servers: ServerInfo[]) {
  const tasks: Promise<any>[] = []

  for (const server of servers) {
    const p = server.usersCommand.getMyInfo()
      .then(user => { server.videoChannel = user.videoChannels[0] })

    tasks.push(p)
  }

  return Promise.all(tasks)
}

export {
  setDefaultVideoChannel
}
