/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */

import { ChildProcess, exec, fork } from 'child_process'
import { join } from 'path'
import { root, wait } from '../miscs/miscs'
import { copy, pathExists, readdir, readFile, remove } from 'fs-extra'
import { expect } from 'chai'
import { VideoChannel } from '../../models/videos'
import { randomInt } from '../../core-utils/miscs/miscs'

interface ServerInfo {
  app: ChildProcess
  url: string
  host: string

  port: number
  parallel: boolean
  internalServerNumber: number
  serverNumber: number

  client: {
    id: string
    secret: string
  }

  user: {
    username: string
    password: string
    email?: string
  }

  customConfigFile?: string

  accessToken?: string
  videoChannel?: VideoChannel

  video?: {
    id: number
    uuid: string
    name?: string
    account?: {
      name: string
    }
  }

  remoteVideo?: {
    id: number
    uuid: string
  }

  videos?: { id: number, uuid: string }[]
}

function parallelTests () {
  return process.env.MOCHA_PARALLEL === 'true'
}

function flushAndRunMultipleServers (totalServers: number, configOverride?: Object) {
  const apps = []
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

    return exec('npm run clean:server:test' + suffix, (err, _stdout, stderr) => {
      if (err || stderr) return rej(err || new Error(stderr))

      return res()
    })
  })
}

function randomServer () {
  const low = 10
  const high = 10000

  return randomInt(low, high)
}

async function flushAndRunServer (serverNumber: number, configOverride?: Object, args = []) {
  const parallel = parallelTests()

  const internalServerNumber = parallel ? randomServer() : serverNumber
  const port = 9000 + internalServerNumber

  await flushTests(internalServerNumber)

  const server: ServerInfo = {
    app: null,
    port,
    internalServerNumber,
    parallel,
    serverNumber,
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

  return runServer(server, configOverride, args)
}

async function runServer (server: ServerInfo, configOverrideArg?: any, args = []) {
  // These actions are async so we need to be sure that they have both been done
  const serverRunString = {
    'Server listening': false
  }
  const key = 'Database peertube_test' + server.internalServerNumber + ' is ready'
  serverRunString[key] = false

  const regexps = {
    client_id: 'Client id: (.+)',
    client_secret: 'Client secret: (.+)',
    user_username: 'Username: (.+)',
    user_password: 'User password: (.+)'
  }

  if (server.internalServerNumber !== server.serverNumber) {
    const basePath = join(root(), 'config')

    const tmpConfigFile = join(basePath, `test-${server.internalServerNumber}.yaml`)
    await copy(join(basePath, `test-${server.serverNumber}.yaml`), tmpConfigFile)

    server.customConfigFile = tmpConfigFile
  }

  const configOverride: any = {}

  if (server.parallel) {
    Object.assign(configOverride, {
      listen: {
        port: server.port
      },
      webserver: {
        port: server.port
      },
      database: {
        suffix: '_test' + server.internalServerNumber
      },
      storage: {
        tmp: `test${server.internalServerNumber}/tmp/`,
        avatars: `test${server.internalServerNumber}/avatars/`,
        videos: `test${server.internalServerNumber}/videos/`,
        streaming_playlists: `test${server.internalServerNumber}/streaming-playlists/`,
        redundancy: `test${server.internalServerNumber}/redundancy/`,
        logs: `test${server.internalServerNumber}/logs/`,
        previews: `test${server.internalServerNumber}/previews/`,
        thumbnails: `test${server.internalServerNumber}/thumbnails/`,
        torrents: `test${server.internalServerNumber}/torrents/`,
        captions: `test${server.internalServerNumber}/captions/`,
        cache: `test${server.internalServerNumber}/cache/`,
        plugins: `test${server.internalServerNumber}/plugins/`
      },
      admin: {
        email: `admin${server.internalServerNumber}@example.com`
      }
    })
  }

  if (configOverrideArg !== undefined) {
    Object.assign(configOverride, configOverrideArg)
  }

  // Share the environment
  const env = Object.create(process.env)
  env['NODE_ENV'] = 'test'
  env['NODE_APP_INSTANCE'] = server.internalServerNumber.toString()
  env['NODE_CONFIG'] = JSON.stringify(configOverride)

  const options = {
    silent: true,
    env,
    detached: true
  }

  return new Promise<ServerInfo>(res => {
    server.app = fork(join(root(), 'dist', 'server.js'), args, options)
    server.app.stdout.on('data', function onStdout (data) {
      let dontContinue = false

      // Capture things if we want to
      for (const key of Object.keys(regexps)) {
        const regexp = regexps[key]
        const matches = data.toString().match(regexp)
        if (matches !== null) {
          if (key === 'client_id') server.client.id = matches[1]
          else if (key === 'client_secret') server.client.secret = matches[1]
          else if (key === 'user_username') server.user.username = matches[1]
          else if (key === 'user_password') server.user.password = matches[1]
        }
      }

      // Check if all required sentences are here
      for (const key of Object.keys(serverRunString)) {
        if (data.toString().indexOf(key) !== -1) serverRunString[key] = true
        if (serverRunString[key] === false) dontContinue = true
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
}

async function reRunServer (server: ServerInfo, configOverride?: any) {
  const newServer = await runServer(server, configOverride)
  server.app = newServer.app

  return server
}

function checkTmpIsEmpty (server: ServerInfo) {
  return checkDirectoryIsEmpty(server, 'tmp', [ 'plugins-global.css' ])
}

async function checkDirectoryIsEmpty (server: ServerInfo, directory: string, exceptions: string[] = []) {
  const testDirectory = 'test' + server.internalServerNumber

  const directoryPath = join(root(), testDirectory, directory)

  const directoryExists = await pathExists(directoryPath)
  expect(directoryExists).to.be.true

  const files = await readdir(directoryPath)
  const filtered = files.filter(f => exceptions.includes(f) === false)

  expect(filtered).to.have.lengthOf(0)
}

function killallServers (servers: ServerInfo[]) {
  for (const server of servers) {
    if (!server.app) continue

    process.kill(-server.app.pid)
    server.app = null
  }
}

function cleanupTests (servers: ServerInfo[]) {
  killallServers(servers)

  const p: Promise<any>[] = []
  for (const server of servers) {
    if (server.parallel) {
      p.push(flushTests(server.internalServerNumber))
    }

    if (server.customConfigFile) {
      p.push(remove(server.customConfigFile))
    }
  }

  return Promise.all(p)
}

async function waitUntilLog (server: ServerInfo, str: string, count = 1, strictCount = true) {
  const logfile = join(root(), 'test' + server.internalServerNumber, 'logs/peertube.log')

  while (true) {
    const buf = await readFile(logfile)

    const matches = buf.toString().match(new RegExp(str, 'g'))
    if (matches && matches.length === count) return
    if (matches && strictCount === false && matches.length >= count) return

    await wait(1000)
  }
}

// ---------------------------------------------------------------------------

export {
  checkDirectoryIsEmpty,
  checkTmpIsEmpty,
  ServerInfo,
  parallelTests,
  cleanupTests,
  flushAndRunMultipleServers,
  flushTests,
  flushAndRunServer,
  killallServers,
  reRunServer,
  waitUntilLog
}
