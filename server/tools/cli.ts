const config = require('application-config')('PeerTube/CLI')
const netrc = require('netrc-parser').default

const version = () => {
  const tag = require('child_process')
    .execSync('[[ ! -d .git ]] || git name-rev --name-only --tags --no-undefined HEAD 2>/dev/null || true', { stdio: [0,1,2] })
  if (tag) return tag

  const version = require('child_process')
    .execSync('[[ ! -d .git ]] || git rev-parse --short HEAD').toString().trim()
  if (version) return version

  return require('../../../package.json').version
}

let settings = {
  remotes: [],
  default: 0
}

interface Settings {
  remotes: any[],
  default: number
}

async function getSettings () {
  return new Promise<Settings>((res, rej) => {
    let settings = {
      remotes: [],
      default: 0
    } as Settings
    config.read((err, data) => {
      if (err) {
        return rej(err)
      }
      return res(data || settings)
    })
  })
}

async function writeSettings (settings) {
  return new Promise((res, rej) => {
    config.write(settings, function (err) {
      if (err) {
        return rej(err)
      }
      return res()
    })
  })
}

netrc.loadSync()

// ---------------------------------------------------------------------------

export {
  version,
  config,
  settings,
  getSettings,
  writeSettings,
  netrc
}
