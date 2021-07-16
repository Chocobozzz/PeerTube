import { ServerInfo } from '../server/servers'

function setDefaultVideoChannel (servers: ServerInfo[]) {
  const tasks: Promise<any>[] = []

  for (const server of servers) {
    const p = server.users.getMyInfo()
      .then(user => { server.store.channel = user.videoChannels[0] })

    tasks.push(p)
  }

  return Promise.all(tasks)
}

export {
  setDefaultVideoChannel
}
