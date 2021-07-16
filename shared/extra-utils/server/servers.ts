/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */

import { ChildProcess, fork } from 'child_process'
import { copy, ensureDir } from 'fs-extra'
import { join } from 'path'
import { root } from '@server/helpers/core-utils'
import { randomInt } from '../../core-utils/miscs/miscs'
import { VideoChannel } from '../../models/videos'
import { BulkCommand } from '../bulk'
import { CLICommand } from '../cli'
import { CustomPagesCommand } from '../custom-pages'
import { FeedCommand } from '../feeds'
import { LogsCommand } from '../logs'
import { isGithubCI, parallelTests, SQLCommand } from '../miscs'
import { AbusesCommand } from '../moderation'
import { OverviewsCommand } from '../overviews'
import { SearchCommand } from '../search'
import { SocketIOCommand } from '../socket'
import { AccountsCommand, BlocklistCommand, LoginCommand, NotificationsCommand, SubscriptionsCommand, UsersCommand } from '../users'
import {
  BlacklistCommand,
  CaptionsCommand,
  ChangeOwnershipCommand,
  ChannelsCommand,
  HistoryCommand,
  ImportsCommand,
  LiveCommand,
  PlaylistsCommand,
  ServicesCommand,
  StreamingPlaylistsCommand,
  VideosCommand
} from '../videos'
import { CommentsCommand } from '../videos/comments-command'
import { ConfigCommand } from './config-command'
import { ContactFormCommand } from './contact-form-command'
import { DebugCommand } from './debug-command'
import { FollowsCommand } from './follows-command'
import { JobsCommand } from './jobs-command'
import { PluginsCommand } from './plugins-command'
import { RedundancyCommand } from './redundancy-command'
import { ServersCommand } from './servers-command'
import { StatsCommand } from './stats-command'

interface ServerInfo {
  app?: ChildProcess

  url: string
  host?: string
  hostname?: string
  port?: number

  rtmpPort?: number

  parallel?: boolean
  internalServerNumber: number

  serverNumber?: number
  customConfigFile?: string

  store?: {
    client?: {
      id?: string
      secret?: string
    }

    user?: {
      username: string
      password: string
      email?: string
    }

    channel?: VideoChannel

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

    videos?: { id: number, uuid: string }[]
  }

  accessToken?: string
  refreshToken?: string

  bulk?: BulkCommand
  cli?: CLICommand
  customPage?: CustomPagesCommand
  feed?: FeedCommand
  logs?: LogsCommand
  abuses?: AbusesCommand
  overviews?: OverviewsCommand
  search?: SearchCommand
  contactForm?: ContactFormCommand
  debug?: DebugCommand
  follows?: FollowsCommand
  jobs?: JobsCommand
  plugins?: PluginsCommand
  redundancy?: RedundancyCommand
  stats?: StatsCommand
  config?: ConfigCommand
  socketIO?: SocketIOCommand
  accounts?: AccountsCommand
  blocklist?: BlocklistCommand
  subscriptions?: SubscriptionsCommand
  live?: LiveCommand
  services?: ServicesCommand
  blacklist?: BlacklistCommand
  captions?: CaptionsCommand
  changeOwnership?: ChangeOwnershipCommand
  playlists?: PlaylistsCommand
  history?: HistoryCommand
  imports?: ImportsCommand
  streamingPlaylists?: StreamingPlaylistsCommand
  channels?: ChannelsCommand
  comments?: CommentsCommand
  sql?: SQLCommand
  notifications?: NotificationsCommand
  servers?: ServersCommand
  login?: LoginCommand
  users?: UsersCommand
  videos?: VideosCommand
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

  await ServersCommand.flushTests(internalServerNumber)

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
    store: {
      client: {
        id: null,
        secret: null
      },
      user: {
        username: null,
        password: null
      }
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
          if (key === 'client_id') server.store.client.id = matches[1]
          else if (key === 'client_secret') server.store.client.secret = matches[1]
          else if (key === 'user_username') server.store.user.username = matches[1]
          else if (key === 'user_password') server.store.user.password = matches[1]
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

      assignCommands(server)

      res(server)
    })
  })
}

function assignCommands (server: ServerInfo) {
  server.bulk = new BulkCommand(server)
  server.cli = new CLICommand(server)
  server.customPage = new CustomPagesCommand(server)
  server.feed = new FeedCommand(server)
  server.logs = new LogsCommand(server)
  server.abuses = new AbusesCommand(server)
  server.overviews = new OverviewsCommand(server)
  server.search = new SearchCommand(server)
  server.contactForm = new ContactFormCommand(server)
  server.debug = new DebugCommand(server)
  server.follows = new FollowsCommand(server)
  server.jobs = new JobsCommand(server)
  server.plugins = new PluginsCommand(server)
  server.redundancy = new RedundancyCommand(server)
  server.stats = new StatsCommand(server)
  server.config = new ConfigCommand(server)
  server.socketIO = new SocketIOCommand(server)
  server.accounts = new AccountsCommand(server)
  server.blocklist = new BlocklistCommand(server)
  server.subscriptions = new SubscriptionsCommand(server)
  server.live = new LiveCommand(server)
  server.services = new ServicesCommand(server)
  server.blacklist = new BlacklistCommand(server)
  server.captions = new CaptionsCommand(server)
  server.changeOwnership = new ChangeOwnershipCommand(server)
  server.playlists = new PlaylistsCommand(server)
  server.history = new HistoryCommand(server)
  server.imports = new ImportsCommand(server)
  server.streamingPlaylists = new StreamingPlaylistsCommand(server)
  server.channels = new ChannelsCommand(server)
  server.comments = new CommentsCommand(server)
  server.sql = new SQLCommand(server)
  server.notifications = new NotificationsCommand(server)
  server.servers = new ServersCommand(server)
  server.login = new LoginCommand(server)
  server.users = new UsersCommand(server)
  server.videos = new VideosCommand(server)
}

async function reRunServer (server: ServerInfo, configOverride?: any) {
  const newServer = await runServer(server, configOverride)
  server.app = newServer.app

  return server
}

async function killallServers (servers: ServerInfo[]) {
  for (const server of servers) {
    if (!server.app) continue

    await server.sql.cleanup()

    process.kill(-server.app.pid)

    server.app = null
  }
}

async function cleanupTests (servers: ServerInfo[]) {
  await killallServers(servers)

  if (isGithubCI()) {
    await ensureDir('artifacts')
  }

  let p: Promise<any>[] = []
  for (const server of servers) {
    p = p.concat(server.servers.cleanupTests())
  }

  return Promise.all(p)
}

// ---------------------------------------------------------------------------

export {
  ServerInfo,
  cleanupTests,
  flushAndRunMultipleServers,
  flushAndRunServer,
  killallServers,
  reRunServer,
  assignCommands
}
