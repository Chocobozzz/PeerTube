/* tslint:disable:no-unused-expression */

import { ChildProcess, exec, fork } from 'child_process'
import { join } from 'path'
import { root, wait } from '../miscs/miscs'
import { readdir, readFile } from 'fs-extra'
import { existsSync } from 'fs'
import { expect } from 'chai'
import { VideoChannel } from '../../models/videos'

interface ServerInfo {
  app: ChildProcess,
  url: string
  host: string

  port: number
  parallel: boolean
  internalServerNumber: number
  serverNumber: number

  client: {
    id: string,
    secret: string
  }

  user: {
    username: string,
    password: string,
    email?: string
  }

  accessToken?: string
  videoChannel?: VideoChannel

  video?: {
    id: number
    uuid: string
    name: string
    account: {
      name: string
    }
  }

  remoteVideo?: {
    id: number
    uuid: string
  }

  videos?: { id: number, uuid: string }[]
}

function flushAndRunMultipleServers (totalServers: number, configOverride?: Object) {
  let apps = []
  let i = 0

  return new Promise<ServerInfo[]>(res => {
    function anotherServerDone (serverNumber, app) {
      apps[serverNumber - 1] = app
      i++
      if (i === totalServers) {
        return res(apps)
      }
    }

    for (let j = 1; j <= totalServers; j++) {
      flushAndRunServer(j, configOverride).then(app => anotherServerDone(j, app))
    }
  })
}

function flushTests (serverNumber?: number) {
  return new Promise<void>((res, rej) => {
    const suffix = serverNumber ? ` -- ${serverNumber}` : ''

    return exec('npm run clean:server:test' + suffix, err => {
      if (err) return rej(err)

      return res()
    })
  })
}

function randomServer () {
  const low = 10
  const high = 10000

  return Math.floor(Math.random() * (high - low) + low)
}

function flushAndRunServer (serverNumber: number, configOverrideArg?: Object, args = []) {
  const parallel = process.env.MOCHA_PARALLEL === 'true'

  const internalServerNumber = parallel ? randomServer() : serverNumber
  const port = 9000 + internalServerNumber

  const server: ServerInfo = {
    app: null,
    port,
    internalServerNumber,
    parallel,
    serverNumber: internalServerNumber,
    url: `http://localhost:${port}`,
    host: `localhost:${port}`,
    client: {
      id: null,
      secret: null
    },
    user: {
      username: null,
      password: null
    }
  }

  // These actions are async so we need to be sure that they have both been done
  const serverRunString = {
    'Server listening': false
  }
  const key = 'Database peertube_test' + internalServerNumber + ' is ready'
  serverRunString[key] = false

  const regexps = {
    client_id: 'Client id: (.+)',
    client_secret: 'Client secret: (.+)',
    user_username: 'Username: (.+)',
    user_password: 'User password: (.+)'
  }

  // Share the environment
  const env = Object.create(process.env)
  env['NODE_ENV'] = 'test'
  env['NODE_APP_INSTANCE'] = serverNumber.toString()

  let configOverride: any = {}

  if (parallel) {
    configOverride = {
      listen: {
        port: port
      },
      webserver: {
        port: port
      },
      database: {
        suffix: '_test' + internalServerNumber
      },
      storage: {
        tmp: `test${internalServerNumber}/tmp/`,
        avatars: `test${internalServerNumber}/avatars/`,
        videos: `test${internalServerNumber}/videos/`,
        streaming_playlists: `test${internalServerNumber}/streaming-playlists/`,
        redundancy: `test${internalServerNumber}/redundancy/`,
        logs: `test${internalServerNumber}/logs/`,
        previews: `test${internalServerNumber}/previews/`,
        thumbnails: `test${internalServerNumber}/thumbnails/`,
        torrents: `test${internalServerNumber}/torrents/`,
        captions: `test${internalServerNumber}/captions/`,
        cache: `test${internalServerNumber}/cache/`
      },
      admin: {
        email: `admin${internalServerNumber}@example.com`
      }
    }
  }

  if (configOverrideArg !== undefined) {
    Object.assign(configOverride, configOverrideArg)
  }

  env['NODE_CONFIG'] = JSON.stringify(configOverride)

  const options = {
    silent: true,
    env: env,
    detached: true
  }

  return new Promise<ServerInfo>(res => {
    flushTests(internalServerNumber)
      .then(() => {

        server.app = fork(join(root(), 'dist', 'server.js'), args, options)
        server.app.stdout.on('data', function onStdout (data) {
          let dontContinue = false

          // Capture things if we want to
          for (const key of Object.keys(regexps)) {
            const regexp = regexps[ key ]
            const matches = data.toString().match(regexp)
            if (matches !== null) {
              if (key === 'client_id') server.client.id = matches[ 1 ]
              else if (key === 'client_secret') server.client.secret = matches[ 1 ]
              else if (key === 'user_username') server.user.username = matches[ 1 ]
              else if (key === 'user_password') server.user.password = matches[ 1 ]
            }
          }

          // Check if all required sentences are here
          for (const key of Object.keys(serverRunString)) {
            if (data.toString().indexOf(key) !== -1) serverRunString[ key ] = true
            if (serverRunString[ key ] === false) dontContinue = true
          }

          // If no, there is maybe one thing not already initialized (client/user credentials generation...)
          if (dontContinue === true) return

          server.app.stdout.removeListener('data', onStdout)

          process.on('exit', () => {
            try {
              process.kill(server.app.pid)
            } catch { /* empty */ }
          })

          res(server)
        })
      })
  })
}

async function reRunServer (server: ServerInfo, configOverride?: any) {
  const newServer = await flushAndRunServer(server.serverNumber, configOverride)
  server.app = newServer.app

  return server
}

async function checkTmpIsEmpty (server: ServerInfo) {
  return checkDirectoryIsEmpty(server, 'tmp')
}

async function checkDirectoryIsEmpty (server: ServerInfo, directory: string) {
  const testDirectory = 'test' + server.serverNumber

  const directoryPath = join(root(), testDirectory, directory)

  const directoryExists = existsSync(directoryPath)
  expect(directoryExists).to.be.true

  const files = await readdir(directoryPath)
  expect(files).to.have.lengthOf(0)
}

function killallServers (servers: ServerInfo[]) {
  for (const server of servers) {
    process.kill(-server.app.pid)
  }
}

function cleanupTests (servers: ServerInfo[]) {
  killallServers(servers)

  const p: Promise<any>[] = []
  for (const server of servers) {
    if (server.parallel) {
      p.push(flushTests(server.internalServerNumber))
    }
  }

  return Promise.all(p)
}

async function waitUntilLog (server: ServerInfo, str: string, count = 1) {
  const logfile = join(root(), 'test' + server.serverNumber, 'logs/peertube.log')

  while (true) {
    const buf = await readFile(logfile)

    const matches = buf.toString().match(new RegExp(str, 'g'))
    if (matches && matches.length === count) return

    await wait(1000)
  }
}

// ---------------------------------------------------------------------------

export {
  checkDirectoryIsEmpty,
  checkTmpIsEmpty,
  ServerInfo,
  cleanupTests,
  flushAndRunMultipleServers,
  flushTests,
  flushAndRunServer,
  killallServers,
  reRunServer,
  waitUntilLog
}
