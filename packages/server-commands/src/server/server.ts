import { randomInt } from '@peertube/peertube-core-utils'
import { Video, VideoChannel, VideoChannelSync, VideoCreateResult, VideoDetails } from '@peertube/peertube-models'
import { parallelTests, root } from '@peertube/peertube-node-utils'
import { ChildProcess, fork } from 'child_process'
import { copy } from 'fs-extra/esm'
import { join } from 'path'
import { BulkCommand } from '../bulk/index.js'
import { CLICommand } from '../cli/index.js'
import { CustomPagesCommand } from '../custom-pages/index.js'
import { FeedCommand } from '../feeds/index.js'
import { LogsCommand } from '../logs/index.js'
import { AbusesCommand, AutomaticTagsCommand, WatchedWordsCommand } from '../moderation/index.js'
import { OverviewsCommand } from '../overviews/index.js'
import { RunnerJobsCommand, RunnerRegistrationTokensCommand, RunnersCommand } from '../runners/index.js'
import { SearchCommand } from '../search/index.js'
import { SocketIOCommand } from '../socket/index.js'
import {
  AccountsCommand,
  BlocklistCommand,
  LoginCommand,
  NotificationsCommand,
  RegistrationsCommand,
  SubscriptionsCommand,
  TwoFactorCommand,
  UserExportsCommand,
  UserImportsCommand,
  UsersCommand
} from '../users/index.js'
import {
  BlacklistCommand,
  CaptionsCommand,
  ChangeOwnershipCommand,
  ChannelSyncsCommand,
  ChannelsCommand,
  ChaptersCommand,
  CommentsCommand,
  HistoryCommand,
  LiveCommand,
  PlaylistsCommand,
  ServicesCommand,
  StoryboardCommand,
  StreamingPlaylistsCommand,
  VideoImportsCommand,
  VideoPasswordsCommand,
  VideoStatsCommand,
  VideoStudioCommand,
  VideoTokenCommand,
  VideosCommand,
  ViewsCommand
} from '../videos/index.js'
import { ConfigCommand } from './config-command.js'
import { ContactFormCommand } from './contact-form-command.js'
import { DebugCommand } from './debug-command.js'
import { FollowsCommand } from './follows-command.js'
import { JobsCommand } from './jobs-command.js'
import { MetricsCommand } from './metrics-command.js'
import { PluginsCommand } from './plugins-command.js'
import { RedundancyCommand } from './redundancy-command.js'
import { ServersCommand } from './servers-command.js'
import { StatsCommand } from './stats-command.js'

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
  videoImports?: VideoImportsCommand
  channelSyncs?: ChannelSyncsCommand
  streamingPlaylists?: StreamingPlaylistsCommand
  channels?: ChannelsCommand
  comments?: CommentsCommand
  notifications?: NotificationsCommand
  servers?: ServersCommand
  login?: LoginCommand
  users?: UsersCommand
  videoStudio?: VideoStudioCommand
  videos?: VideosCommand
  videoStats?: VideoStatsCommand
  views?: ViewsCommand
  twoFactor?: TwoFactorCommand
  videoToken?: VideoTokenCommand
  registrations?: RegistrationsCommand
  videoPasswords?: VideoPasswordsCommand

  storyboard?: StoryboardCommand
  chapters?: ChaptersCommand

  userImports?: UserImportsCommand
  userExports?: UserExportsCommand

  runners?: RunnersCommand
  runnerRegistrationTokens?: RunnerRegistrationTokensCommand
  runnerJobs?: RunnerJobsCommand

  watchedWordsLists?: WatchedWordsCommand
  autoTags?: AutomaticTagsCommand

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

    this.url = `http://127.0.0.1:${this.port}`
    this.host = `127.0.0.1:${this.port}`
    this.hostname = '127.0.0.1'
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

  async flushAndRun (configOverride?: object, options: RunServerOptions = {}) {
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
    const env = { ...process.env }
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
      detached: false,
      execArgv
    }

    const peertubeArgs = options.peertubeArgs || []

    return new Promise<void>((res, rej) => {
      const self = this
      let aggregatedLogs = ''

      this.app = fork(join(root(), 'dist', 'server.js'), peertubeArgs, forkOptions)

      const onPeerTubeExit = () => rej(new Error('Process exited:\n' + aggregatedLogs))
      const onParentExit = () => {
        if (!this.app?.pid) return

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

  kill () {
    if (!this.app) return Promise.resolve()

    process.kill(this.app.pid)

    this.app = null

    return Promise.resolve()
  }

  private randomServer () {
    const low = 2500
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
        tmp_persistent: this.getDirectoryPath('tmp-persistent') + '/',
        bin: this.getDirectoryPath('bin') + '/',
        avatars: this.getDirectoryPath('avatars') + '/',
        web_videos: this.getDirectoryPath('web-videos') + '/',
        streaming_playlists: this.getDirectoryPath('streaming-playlists') + '/',
        original_video_files: this.getDirectoryPath('original-video-files') + '/',
        redundancy: this.getDirectoryPath('redundancy') + '/',
        logs: this.getDirectoryPath('logs') + '/',
        previews: this.getDirectoryPath('previews') + '/',
        thumbnails: this.getDirectoryPath('thumbnails') + '/',
        storyboards: this.getDirectoryPath('storyboards') + '/',
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
    this.videoImports = new VideoImportsCommand(this)
    this.channelSyncs = new ChannelSyncsCommand(this)
    this.streamingPlaylists = new StreamingPlaylistsCommand(this)
    this.channels = new ChannelsCommand(this)
    this.comments = new CommentsCommand(this)
    this.notifications = new NotificationsCommand(this)
    this.servers = new ServersCommand(this)
    this.login = new LoginCommand(this)
    this.users = new UsersCommand(this)
    this.videos = new VideosCommand(this)
    this.videoStudio = new VideoStudioCommand(this)
    this.videoStats = new VideoStatsCommand(this)
    this.views = new ViewsCommand(this)
    this.twoFactor = new TwoFactorCommand(this)
    this.videoToken = new VideoTokenCommand(this)
    this.registrations = new RegistrationsCommand(this)

    this.storyboard = new StoryboardCommand(this)
    this.chapters = new ChaptersCommand(this)

    this.userExports = new UserExportsCommand(this)
    this.userImports = new UserImportsCommand(this)

    this.runners = new RunnersCommand(this)
    this.runnerRegistrationTokens = new RunnerRegistrationTokensCommand(this)
    this.runnerJobs = new RunnerJobsCommand(this)
    this.videoPasswords = new VideoPasswordsCommand(this)

    this.watchedWordsLists = new WatchedWordsCommand(this)
    this.autoTags = new AutomaticTagsCommand(this)
  }
}
