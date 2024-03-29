import applicationConfig from 'application-config'
import { Netrc } from 'netrc-parser'
import { join } from 'path'
import { createLogger, format, transports } from 'winston'
import { UserRole } from '@peertube/peertube-models'
import { getAppNumber, isTestInstance, root } from '@peertube/peertube-node-utils'
import { PeerTubeServer } from '@peertube/peertube-server-commands'

export type CommonProgramOptions = {
  url?: string
  username?: string
  password?: string
}

let configName = 'PeerTube/CLI'
if (isTestInstance()) configName += `-${getAppNumber()}`

const config = applicationConfig(configName)

const version: string = process.env.PACKAGE_VERSION

async function getAdminTokenOrDie (server: PeerTubeServer, username: string, password: string) {
  const token = await server.login.getAccessToken(username, password)
  const me = await server.users.getMyInfo({ token })

  if (me.role.id !== UserRole.ADMINISTRATOR) {
    console.error('You must be an administrator.')
    process.exit(-1)
  }

  return token
}

interface Settings {
  remotes: any[]
  default: number
}

async function getSettings () {
  const defaultSettings: Settings = {
    remotes: [],
    default: -1
  }

  const data = await config.read() as Promise<Settings>

  return Object.keys(data).length === 0
    ? defaultSettings
    : data
}

async function getNetrc () {
  const netrc = isTestInstance()
    ? new Netrc(join(root(import.meta.url), 'test' + getAppNumber(), 'netrc'))
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
  options: CommonProgramOptions,
  settings: Settings,
  netrc: Netrc
): { url: string, username: string, password: string } {

  function exitIfNoOptions (optionNames: string[], errorPrefix: string = '') {
    let exit = false

    for (const key of optionNames) {
      if (!options[key]) {
        if (exit === false && errorPrefix) console.error(errorPrefix)

        console.error(`--${key} field is required`)
        exit = true
      }
    }

    if (exit) process.exit(-1)
  }

  // If username or password are specified, both are mandatory
  if (options.username || options.password) {
    exitIfNoOptions([ 'username', 'password' ])
  }

  // If no available machines, url, username and password args are mandatory
  if (Object.keys(netrc.machines).length === 0) {
    exitIfNoOptions([ 'url', 'username', 'password' ], 'No account found in netrc')
  }

  if (settings.remotes.length === 0 || settings.default === -1) {
    exitIfNoOptions([ 'url' ], 'No default instance found')
  }

  let url: string = options.url
  let username: string = options.username
  let password: string = options.password

  if (!url && settings.default !== -1) url = settings.remotes[settings.default]

  const machine = netrc.machines[url]
  if ((!username || !password) && !machine) {
    console.error('Cannot find existing configuration for %s.', url)
    process.exit(-1)
  }

  if (!username && machine) username = machine.login
  if (!password && machine) password = machine.password

  return { url, username, password }
}

function listOptions (val: string) {
  return val.split(',')
}

function getServerCredentials (options: CommonProgramOptions) {
  return Promise.all([ getSettings(), getNetrc() ])
                .then(([ settings, netrc ]) => {
                  return getRemoteObjectOrDie(options, settings, netrc)
                })
}

function buildServer (url: string) {
  return new PeerTubeServer({ url })
}

async function assignToken (server: PeerTubeServer, username: string, password: string) {
  const bodyClient = await server.login.getClient()
  const client = { id: bodyClient.client_id, secret: bodyClient.client_secret }

  const body = await server.login.login({ client, user: { username, password } })

  server.accessToken = body.access_token
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

  listOptions,

  getAdminTokenOrDie,
  buildServer,
  assignToken
}
