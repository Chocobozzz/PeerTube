const config = require('application-config')('PeerTube/CLI')
const netrc = require('netrc-parser').default

const version = require('../../../package.json').version

interface Settings {
  remotes: any[],
  default: number
}

function getSettings () {
  return new Promise<Settings>((res, rej) => {
    const defaultSettings = {
      remotes: [],
      default: 0
    }

    config.read((err, data) => {
      if (err) return rej(err)

      return res(Object.keys(data).length === 0 ? defaultSettings : data)
    })
  })
}

async function getNetrc () {
  await netrc.load()

  return netrc
}

function writeSettings (settings) {
  return new Promise((res, rej) => {
    config.write(settings, function (err) {
      if (err) return rej(err)

      return res()
    })
  })
}

function getRemoteObjectOrDie (program: any, settings: Settings) {
  if (!program['url'] || !program['username'] || !program['password']) {
    // No remote and we don't have program parameters: throw
    if (settings.remotes.length === 0) {
      if (!program[ 'url' ]) console.error('--url field is required.')
      if (!program[ 'username' ]) console.error('--username field is required.')
      if (!program[ 'password' ]) console.error('--password field is required.')

      return process.exit(-1)
    }

    let url: string = program['url']
    let username: string = program['username']
    let password: string = program['password']

    if (!url) {
      url = settings.default !== -1
        ? settings.remotes[settings.default]
        : settings.remotes[0]
    }

    if (!username) username = netrc.machines[url].login
    if (!password) password = netrc.machines[url].password

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
  writeSettings
}
