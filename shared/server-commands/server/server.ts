import { ChildProcess, fork } from 'child_process'
import { copy } from 'fs-extra'
import { join } from 'path'
import { parallelTests, randomInt, root } from '@shared/core-utils'
import { Video, VideoChannel, VideoChannelSync, VideoCreateResult, VideoDetails } from '@shared/models'
import { BulkCommand } from '../bulk'
import { CLICommand } from '../cli'
import { CustomPagesCommand } from '../custom-pages'
import { FeedCommand } from '../feeds'
import { LogsCommand } from '../logs'
import { SQLCommand } from '../miscs'
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
  ChannelSyncsCommand,
  HistoryCommand,
  ImportsCommand,
  LiveCommand,
  PlaylistsCommand,
  ServicesCommand,
  StreamingPlaylistsCommand,
  VideosCommand,
  VideoStudioCommand,
  ViewsCommand
} from '../videos'
import { CommentsCommand } from '../videos/comments-command'
import { VideoStatsCommand } from '../videos/video-stats-command'
import { ConfigCommand } from './config-command'
import { ContactFormCommand } from './contact-form-command'
import { DebugCommand } from './debug-command'
import { FollowsCommand } from './follows-command'
import { JobsCommand } from './jobs-command'
import { MetricsCommand } from './metrics-command'
import { ObjectStorageCommand } from './object-storage-command'
import { PluginsCommand } from './plugins-command'
import { RedundancyCommand } from './redundancy-command'
import { ServersCommand } from './servers-command'
import { StatsCommand } from './stats-command'

export type RunServerOptions = {
  hideLogs?: boolean
  nodeArgs?: string[]
  peertubeArgs?: string[]
  env?: { [ id: string ]: string }
}

export class PeerTubeServer {
  app?: ChildProcess

  url: string
  host?: string
  hostname?: string
  port?: number

  rtmpPort?: number
  rtmpsPort?: number

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
    videoChannelSync?: Partial<VideoChannelSync>

    video?: Video
    videoCreated?: VideoCreateResult
    videoDetails?: VideoDetails

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
  metrics?: MetricsCommand
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
  channelSyncs?: ChannelSyncsCommand
  streamingPlaylists?: StreamingPlaylistsCommand
  channels?: ChannelsCommand
  comments?: CommentsCommand
  sql?: SQLCommand
  notifications?: NotificationsCommand
  servers?: ServersCommand
  login?: LoginCommand
  users?: UsersCommand
  objectStorage?: ObjectStorageCommand
  videoStudio?: VideoStudioCommand
  videos?: VideosCommand
  videoStats?: VideoStatsCommand
  views?: ViewsCommand

  constructor (options: { serverNumber: number } | { url: string }) {
    if ((options as any).url) {
      this.setUrl((options as any).url)
    } else {
      this.setServerNumber((options as any).serverNumber)
    }

    this.store = {
      client: {
        id: null,
        secret: null
      },
      user: {
        username: null,
        password: null
      }
    }

    this.assignCommands()
  }

  setServerNumber (serverNumber: number) {
    this.serverNumber = serverNumber

    this.parallel = parallelTests()

    this.internalServerNumber = this.parallel ? this.randomServer() : this.serverNumber
    this.rtmpPort = this.parallel ? this.randomRTMP() : 1936
    this.rtmpsPort = this.parallel ? this.randomRTMP() : 1937
    this.port = 9000 + this.internalServerNumber

    this.url = `http://localhost:${this.port}`
    this.host = `localhost:${this.port}`
    this.hostname = 'localhost'
  }

  setUrl (url: string) {
    const parsed = new URL(url)

    this.url = url
    this.host = parsed.host
    this.hostname = parsed.hostname
    this.port = parseInt(parsed.port)
  }

  getDirectoryPath (directoryName: string) {
    const testDirectory = 'test' + this.internalServerNumber

    return join(root(), testDirectory, directoryName)
  }

  async flushAndRun (configOverride?: Object, options: RunServerOptions = {}) {
    await ServersCommand.flushTests(this.internalServerNumber)

    return this.run(configOverride, options)
  }

  async run (configOverrideArg?: any, options: RunServerOptions = {}) {
    // These actions are async so we need to be sure that they have both been done
    const serverRunString = {
      'HTTP server listening': false
    }
    const key = 'Database peertube_test' + this.internalServerNumber + ' is ready'
    serverRunString[key] = false

    const regexps = {
      client_id: 'Client id: (.+)',
      client_secret: 'Client secret: (.+)',
      user_username: 'Username: (.+)',
      user_password: 'User password: (.+)'
    }

    await this.assignCustomConfigFile()

    const configOverride = this.buildConfigOverride()

    if (configOverrideArg !== undefined) {
      Object.assign(configOverride, configOverrideArg)
    }

    // Share the environment
    const env = Object.create(process.env)
    env['NODE_ENV'] = 'test'
    env['NODE_APP_INSTANCE'] = this.internalServerNumber.toString()
    env['NODE_CONFIG'] = JSON.stringify(configOverride)

    if (options.env) {
      Object.assign(env, options.env)
    }

    const execArgv = options.nodeArgs || []
    // FIXME: too slow :/
    // execArgv.push('--enable-source-maps')

    const forkOptions = {
      silent: true,
      env,
      detached: true,
      execArgv
    }

    const peertubeArgs = options.peertubeArgs || []

    return new Promise<void>((res, rej) => {
      const self = this
      let aggregatedLogs = ''

      this.app = fork(join(root(), 'dist', 'server.js'), peertubeArgs, forkOptions)

      const onPeerTubeExit = () => rej(new Error('Process exited:\n' + aggregatedLogs))
      const onParentExit = () => {
        if (!this.app || !this.app.pid) return

        try {
          process.kill(self.app.pid)
        } catch { /* empty */ }
      }

      this.app.on('exit', onPeerTubeExit)
      process.on('exit', onParentExit)

      this.app.stdout.on('data', function onStdout (data) {
        let dontContinue = false

        const log: string = data.toString()
        aggregatedLogs += log

        // Capture things if we want to
        for (const key of Object.keys(regexps)) {
          const regexp = regexps[key]
          const matches = log.match(regexp)
          if (matches !== null) {
            if (key === 'client_id') self.store.client.id = matches[1]
            else if (key === 'client_secret') self.store.client.secret = matches[1]
            else if (key === 'user_username') self.store.user.username = matches[1]
            else if (key === 'user_password') self.store.user.password = matches[1]
          }
        }

        // Check if all required sentences are here
        for (const key of Object.keys(serverRunString)) {
          if (log.includes(key)) serverRunString[key] = true
          if (serverRunString[key] === false) dontContinue = true
        }

        // If no, there is maybe one thing not already initialized (client/user credentials generation...)
        if (dontContinue === true) return

        if (options.hideLogs === false) {
          console.log(log)
        } else {
          process.removeListener('exit', onParentExit)
          self.app.stdout.removeListener('data', onStdout)
          self.app.removeListener('exit', onPeerTubeExit)
        }

        res()
      })
    })
  }

  async kill () {
    if (!this.app) return

    await this.sql.cleanup()

    process.kill(-this.app.pid)

    this.app = null
  }

  private randomServer () {
    const low = 10
    const high = 10000

    return randomInt(low, high)
  }

  private randomRTMP () {
    const low = 1900
    const high = 2100

    return randomInt(low, high)
  }

  private async assignCustomConfigFile () {
    if (this.internalServerNumber === this.serverNumber) return

    const basePath = join(root(), 'config')

    const tmpConfigFile = join(basePath, `test-${this.internalServerNumber}.yaml`)
    await copy(join(basePath, `test-${this.serverNumber}.yaml`), tmpConfigFile)

    this.customConfigFile = tmpConfigFile
  }

  private buildConfigOverride () {
    if (!this.parallel) return {}

    return {
      listen: {
        port: this.port
      },
      webserver: {
        port: this.port
      },
      database: {
        suffix: '_test' + this.internalServerNumber
      },
      storage: {
        tmp: this.getDirectoryPath('tmp') + '/',
        bin: this.getDirectoryPath('bin') + '/',
        avatars: this.getDirectoryPath('avatars') + '/',
        videos: this.getDirectoryPath('videos') + '/',
        streaming_playlists: this.getDirectoryPath('streaming-playlists') + '/',
        redundancy: this.getDirectoryPath('redundancy') + '/',
        logs: this.getDirectoryPath('logs') + '/',
        previews: this.getDirectoryPath('previews') + '/',
        thumbnails: this.getDirectoryPath('thumbnails') + '/',
        torrents: this.getDirectoryPath('torrents') + '/',
        captions: this.getDirectoryPath('captions') + '/',
        cache: this.getDirectoryPath('cache') + '/',
        plugins: this.getDirectoryPath('plugins') + '/',
        well_known: this.getDirectoryPath('well-known') + '/'
      },
      admin: {
        email: `admin${this.internalServerNumber}@example.com`
      },
      live: {
        rtmp: {
          port: this.rtmpPort
        }
      }
    }
  }

  private assignCommands () {
    this.bulk = new BulkCommand(this)
    this.cli = new CLICommand(this)
    this.customPage = new CustomPagesCommand(this)
    this.feed = new FeedCommand(this)
    this.logs = new LogsCommand(this)
    this.abuses = new AbusesCommand(this)
    this.overviews = new OverviewsCommand(this)
    this.search = new SearchCommand(this)
    this.contactForm = new ContactFormCommand(this)
    this.debug = new DebugCommand(this)
    this.follows = new FollowsCommand(this)
    this.jobs = new JobsCommand(this)
    this.metrics = new MetricsCommand(this)
    this.plugins = new PluginsCommand(this)
    this.redundancy = new RedundancyCommand(this)
    this.stats = new StatsCommand(this)
    this.config = new ConfigCommand(this)
    this.socketIO = new SocketIOCommand(this)
    this.accounts = new AccountsCommand(this)
    this.blocklist = new BlocklistCommand(this)
    this.subscriptions = new SubscriptionsCommand(this)
    this.live = new LiveCommand(this)
    this.services = new ServicesCommand(this)
    this.blacklist = new BlacklistCommand(this)
    this.captions = new CaptionsCommand(this)
    this.changeOwnership = new ChangeOwnershipCommand(this)
    this.playlists = new PlaylistsCommand(this)
    this.history = new HistoryCommand(this)
    this.imports = new ImportsCommand(this)
    this.channelSyncs = new ChannelSyncsCommand(this)
    this.streamingPlaylists = new StreamingPlaylistsCommand(this)
    this.channels = new ChannelsCommand(this)
    this.comments = new CommentsCommand(this)
    this.sql = new SQLCommand(this)
    this.notifications = new NotificationsCommand(this)
    this.servers = new ServersCommand(this)
    this.login = new LoginCommand(this)
    this.users = new UsersCommand(this)
    this.videos = new VideosCommand(this)
    this.objectStorage = new ObjectStorageCommand(this)
    this.videoStudio = new VideoStudioCommand(this)
    this.videoStats = new VideoStatsCommand(this)
    this.views = new ViewsCommand(this)
  }
}
