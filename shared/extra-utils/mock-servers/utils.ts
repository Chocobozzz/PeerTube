import { Server } from 'http'

function terminateServer (server: Server) {
  if (!server) return Promise.resolve()

  return new Promise<void>((res, rej) => {
    server.close(err => {
      if (err) return rej(err)

      return res()
    })
  })
}

export {
  terminateServer
}
