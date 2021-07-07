/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */

import { expect } from 'chai'
import { ChildProcess, exec, fork } from 'child_process'
import { copy, ensureDir, pathExists, readdir, readFile, remove } from 'fs-extra'
import { join } from 'path'
import { randomInt } from '../../core-utils/miscs/miscs'
import { VideoChannel } from '../../models/videos'
import { buildServerDirectory, getFileSize, isGithubCI, root, wait } from '../miscs/miscs'
import { makeGetRequest } from '../requests/requests'

interface ServerInfo {
  app: ChildProcess

  url: string
  host: string
  hostname: string
  port: number

  rtmpPort: number

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
  refreshToken?: string
  videoChannel?: VideoChannel

  video?: {
    id: number
    uuid: string
    shortUUID: string
    name?: string
    url?: string

    account?: {
      name: string
    }

    embedPath?: string
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

function randomRTMP () {
  const low = 1900
  const high = 2100

  return randomInt(low, high)
}

type RunServerOptions = {
  hideLogs?: boolean
  execArgv?: string[]
}

async function flushAndRunServer (serverNumber: number, configOverride?: Object, args = [], options: RunServerOptions = {}) {
  const parallel = parallelTests()

  const internalServerNumber = parallel ? randomServer() : serverNumber
  const rtmpPort = parallel ? randomRTMP() : 1936
  const port = 9000 + internalServerNumber

  await flushTests(internalServerNumber)

  const server: ServerInfo = {
    app: null,
    port,
    internalServerNumber,
    rtmpPort,
    parallel,
    serverNumber,
    url: `http://localhost:${port}`,
    host: `localhost:${port}`,
    hostname: 'localhost',
    client: {
      id: null,
      secret: null
    },
    user: {
      username: null,
      password: null
    }
  }

  return runServer(server, configOverride, args, options)
}

async function runServer (server: ServerInfo, configOverrideArg?: any, args = [], options: RunServerOptions = {}) {
  // These actions are async so we need to be sure that they have both been done
  const serverRunString = {
    'HTTP server listening': false
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
      },
      live: {
        rtmp: {
          port: server.rtmpPort
        }
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

  const forkOptions = {
    silent: true,
    env,
    detached: true,
    execArgv: options.execArgv || []
  }

  return new Promise<ServerInfo>(res => {
    server.app = fork(join(root(), 'dist', 'server.js'), args, forkOptions)
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

      if (options.hideLogs === false) {
        console.log(data.toString())
      } else {
        server.app.stdout.removeListener('data', onStdout)
      }

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

async function checkTmpIsEmpty (server: ServerInfo) {
  await checkDirectoryIsEmpty(server, 'tmp', [ 'plugins-global.css', 'hls', 'resumable-uploads' ])

  if (await pathExists(join('test' + server.internalServerNumber, 'tmp', 'hls'))) {
    await checkDirectoryIsEmpty(server, 'tmp/hls')
  }
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

async function cleanupTests (servers: ServerInfo[]) {
  killallServers(servers)

  if (isGithubCI()) {
    await ensureDir('artifacts')
  }

  const p: Promise<any>[] = []
  for (const server of servers) {
    if (isGithubCI()) {
      const origin = await buildServerDirectory(server, 'logs/peertube.log')
      const destname = `peertube-${server.internalServerNumber}.log`
      console.log('Saving logs %s.', destname)

      await copy(origin, join('artifacts', destname))
    }

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
  const logfile = buildServerDirectory(server, 'logs/peertube.log')

  while (true) {
    const buf = await readFile(logfile)

    const matches = buf.toString().match(new RegExp(str, 'g'))
    if (matches && matches.length === count) return
    if (matches && strictCount === false && matches.length >= count) return

    await wait(1000)
  }
}

async function getServerFileSize (server: ServerInfo, subPath: string) {
  const path = buildServerDirectory(server, subPath)

  return getFileSize(path)
}

function makePingRequest (server: ServerInfo) {
  return makeGetRequest({
    url: server.url,
    path: '/api/v1/ping',
    statusCodeExpected: 200
  })
}

// ---------------------------------------------------------------------------

export {
  checkDirectoryIsEmpty,
  checkTmpIsEmpty,
  getServerFileSize,
  ServerInfo,
  parallelTests,
  cleanupTests,
  flushAndRunMultipleServers,
  flushTests,
  makePingRequest,
  flushAndRunServer,
  killallServers,
  reRunServer,
  waitUntilLog
}
