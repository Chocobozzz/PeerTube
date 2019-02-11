const config = require('application-config')('PeerTube/CLI')
const netrc = require('netrc-parser').default

const version = require('../../../package.json').version

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
      return res(Object.keys(data).length === 0 ? settings : data)
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
