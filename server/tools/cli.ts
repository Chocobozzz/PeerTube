import { Netrc } from 'netrc-parser'
import { getAppNumber, isTestInstance } from '../helpers/core-utils'
import { join } from 'path'
import { root } from '../../shared/extra-utils/miscs/miscs'
import { getVideoChannel } from '../../shared/extra-utils/videos/video-channels'
import { VideoChannel, VideoPrivacy } from '../../shared/models/videos'
import { createLogger, format, transports } from 'winston'
import { getMyUserInformation } from '@shared/extra-utils/users/users'
import { User, UserRole } from '@shared/models'
import { getAccessToken } from '@shared/extra-utils/users/login'
import { Command } from 'commander'

let configName = 'PeerTube/CLI'
if (isTestInstance()) configName += `-${getAppNumber()}`

const config = require('application-config')(configName)

const version = require('../../../package.json').version

async function getAdminTokenOrDie (url: string, username: string, password: string) {
  const accessToken = await getAccessToken(url, username, password)
  const resMe = await getMyUserInformation(url, accessToken)
  const me: User = resMe.body

  if (me.role !== UserRole.ADMINISTRATOR) {
    console.error('You must be an administrator.')
    process.exit(-1)
  }

  return accessToken
}

interface Settings {
  remotes: any[]
  default: number
}

async function getSettings (): Promise<Settings> {
  const defaultSettings = {
    remotes: [],
    default: -1
  }

  const data = await config.read()

  return Object.keys(data).length === 0
    ? defaultSettings
    : data
}

async function getNetrc () {
  const Netrc = require('netrc-parser').Netrc

  const netrc = isTestInstance()
    ? new Netrc(join(root(), 'test' + getAppNumber(), 'netrc'))
    : new Netrc()

  await netrc.load()

  return netrc
}

function writeSettings (settings: Settings) {
  return config.write(settings)
}

function deleteSettings () {
  return config.trash()
}

function getRemoteObjectOrDie (
  program: Command,
  settings: Settings,
  netrc: Netrc
): { url: string, username: string, password: string } {
  const options = program.opts()

  if (!options.url || !options.username || !options.password) {
    // No remote and we don't have program parameters: quit
    if (settings.remotes.length === 0 || Object.keys(netrc.machines).length === 0) {
      if (!options.url) console.error('--url field is required.')
      if (!options.username) console.error('--username field is required.')
      if (!options.password) console.error('--password field is required.')

      return process.exit(-1)
    }

    let url: string = options.url
    let username: string = options.username
    let password: string = options.password

    if (!url && settings.default !== -1) url = settings.remotes[settings.default]

    const machine = netrc.machines[url]

    if (!username && machine) username = machine.login
    if (!password && machine) password = machine.password

    return { url, username, password }
  }

  return {
    url: options.url,
    username: options.username,
    password: options.password
  }
}

function buildCommonVideoOptions (command: Command) {
  function list (val) {
    return val.split(',')
  }

  return command
    .option('-n, --video-name <name>', 'Video name')
    .option('-c, --category <category_number>', 'Category number')
    .option('-l, --licence <licence_number>', 'Licence number')
    .option('-L, --language <language_code>', 'Language ISO 639 code (fr or en...)')
    .option('-t, --tags <tags>', 'Video tags', list)
    .option('-N, --nsfw', 'Video is Not Safe For Work')
    .option('-d, --video-description <description>', 'Video description')
    .option('-P, --privacy <privacy_number>', 'Privacy')
    .option('-C, --channel-name <channel_name>', 'Channel name')
    .option('--no-comments-enabled', 'Disable video comments')
    .option('-s, --support <support>', 'Video support text')
    .option('--no-wait-transcoding', 'Do not wait transcoding before publishing the video')
    .option('--no-download-enabled', 'Disable video download')
    .option('-v, --verbose <verbose>', 'Verbosity, from 0/\'error\' to 4/\'debug\'', 'info')
}

async function buildVideoAttributesFromCommander (url: string, command: Command, defaultAttributes: any = {}) {
  const options = command.opts()

  const defaultBooleanAttributes = {
    nsfw: false,
    commentsEnabled: true,
    downloadEnabled: true,
    waitTranscoding: true
  }

  const booleanAttributes: { [id in keyof typeof defaultBooleanAttributes]: boolean } | {} = {}

  for (const key of Object.keys(defaultBooleanAttributes)) {
    if (options[key] !== undefined) {
      booleanAttributes[key] = options[key]
    } else if (defaultAttributes[key] !== undefined) {
      booleanAttributes[key] = defaultAttributes[key]
    } else {
      booleanAttributes[key] = defaultBooleanAttributes[key]
    }
  }

  const videoAttributes = {
    name: options.videoName || defaultAttributes.name,
    category: options.category || defaultAttributes.category || undefined,
    licence: options.licence || defaultAttributes.licence || undefined,
    language: options.language || defaultAttributes.language || undefined,
    privacy: options.privacy || defaultAttributes.privacy || VideoPrivacy.PUBLIC,
    support: options.support || defaultAttributes.support || undefined,
    description: options.videoDescription || defaultAttributes.description || undefined,
    tags: options.tags || defaultAttributes.tags || undefined
  }

  Object.assign(videoAttributes, booleanAttributes)

  if (options.channelName) {
    const res = await getVideoChannel(url, options.channelName)
    const videoChannel: VideoChannel = res.body

    Object.assign(videoAttributes, { channelId: videoChannel.id })

    if (!videoAttributes.support && videoChannel.support) {
      Object.assign(videoAttributes, { support: videoChannel.support })
    }
  }

  return videoAttributes
}

function getServerCredentials (program: Command) {
  return Promise.all([ getSettings(), getNetrc() ])
                .then(([ settings, netrc ]) => {
                  return getRemoteObjectOrDie(program, settings, netrc)
                })
}

function getLogger (logLevel = 'info') {
  const logLevels = {
    0: 0,
    error: 0,
    1: 1,
    warn: 1,
    2: 2,
    info: 2,
    3: 3,
    verbose: 3,
    4: 4,
    debug: 4
  }

  const logger = createLogger({
    levels: logLevels,
    format: format.combine(
      format.splat(),
      format.simple()
    ),
    transports: [
      new (transports.Console)({
        level: logLevel
      })
    ]
  })

  return logger
}

// ---------------------------------------------------------------------------

export {
  version,
  getLogger,
  getSettings,
  getNetrc,
  getRemoteObjectOrDie,
  writeSettings,
  deleteSettings,

  getServerCredentials,

  buildCommonVideoOptions,
  buildVideoAttributesFromCommander,

  getAdminTokenOrDie
}
