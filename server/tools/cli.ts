import { Netrc } from 'netrc-parser'
import { isTestInstance, getAppNumber } from '../helpers/core-utils'
import { join } from 'path'
import { root } from '../../shared/extra-utils'

let configName = 'PeerTube/CLI'
if (isTestInstance()) configName += `-${getAppNumber()}`

const config = require('application-config')(configName)

const version = require('../../../package.json').version

interface Settings {
  remotes: any[],
  default: number
}

function getSettings () {
  return new Promise<Settings>((res, rej) => {
    const defaultSettings = {
      remotes: [],
      default: -1
    }

    config.read((err, data) => {
      if (err) return rej(err)

      return res(Object.keys(data).length === 0 ? defaultSettings : data)
    })
  })
}

async function getNetrc () {
  const Netrc = require('netrc-parser').Netrc

  const netrc = isTestInstance()
    ? new Netrc(join(root(), 'test' + getAppNumber(), 'netrc'))
    : new Netrc()

  await netrc.load()

  return netrc
}

function writeSettings (settings) {
  return new Promise((res, rej) => {
    config.write(settings, err => {
      if (err) return rej(err)

      return res()
    })
  })
}

function deleteSettings () {
  return new Promise((res, rej) => {
    config.trash((err) => {
      if (err) return rej(err)

      return res()
    })
  })
}

function getRemoteObjectOrDie (program: any, settings: Settings, netrc: Netrc) {
  if (!program['url'] || !program['username'] || !program['password']) {
    // No remote and we don't have program parameters: quit
    if (settings.remotes.length === 0 || Object.keys(netrc.machines).length === 0) {
      if (!program[ 'url' ]) console.error('--url field is required.')
      if (!program[ 'username' ]) console.error('--username field is required.')
      if (!program[ 'password' ]) console.error('--password field is required.')

      return process.exit(-1)
    }

    let url: string = program['url']
    let username: string = program['username']
    let password: string = program['password']

    if (!url && settings.default !== -1) url = settings.remotes[settings.default]

    const machine = netrc.machines[url]

    if (!username && machine) username = machine.login
    if (!password && machine) password = machine.password

    return { url, username, password }
  }

  return {
    url: program[ 'url' ],
    username: program[ 'username' ],
    password: program[ 'password' ]
  }
}

// ---------------------------------------------------------------------------

export {
  version,
  config,
  getSettings,
  getNetrc,
  getRemoteObjectOrDie,
  writeSettings,
  deleteSettings
}
