import { Express } from 'express'
import { Server } from 'http'
import { AddressInfo } from 'net'

function randomListen (app: Express) {
  return new Promise<Server>(res => {
    const server = app.listen(0, () => res(server))
  })
}

function getPort (server: Server) {
  const address = server.address() as AddressInfo

  return address.port
}

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
  randomListen,
  getPort,
  terminateServer
}
