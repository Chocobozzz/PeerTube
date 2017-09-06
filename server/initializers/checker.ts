import * as config from 'config'

import { promisify0 } from '../helpers/core-utils'
import { OAuthClientModel } from '../models/oauth/oauth-client-interface'
import { UserModel } from '../models/user/user-interface'

// Some checks on configuration files
function checkConfig () {
  if (config.has('webserver.host')) {
    let errorMessage = '`host` config key was renamed to `hostname` but it seems you still have a `host` key in your configuration files!'
    errorMessage += ' Please ensure to rename your `host` configuration to `hostname`.'

    return errorMessage
  }

  return null
}

// Check the config files
function checkMissedConfig () {
  const required = [ 'listen.port',
    'webserver.https', 'webserver.hostname', 'webserver.port',
    'database.hostname', 'database.port', 'database.suffix', 'database.username', 'database.password',
    'storage.certs', 'storage.videos', 'storage.logs', 'storage.thumbnails', 'storage.previews', 'storage.torrents', 'storage.cache',
    'cache.previews.size', 'admin.email', 'signup.enabled', 'signup.limit', 'transcoding.enabled', 'transcoding.threads', 'user.video_quota'
  ]
  const miss: string[] = []

  for (const key of required) {
    if (!config.has(key)) {
      miss.push(key)
    }
  }

  return miss
}

// Check the available codecs
// We get CONFIG by param to not import it in this file (import orders)
function checkFFmpeg (CONFIG: { TRANSCODING: { ENABLED: boolean } }) {
  const Ffmpeg = require('fluent-ffmpeg')
  const getAvailableCodecsPromise = promisify0(Ffmpeg.getAvailableCodecs)

  getAvailableCodecsPromise()
    .then(codecs => {
      if (CONFIG.TRANSCODING.ENABLED === false) return undefined

      const canEncode = [ 'libx264' ]
      canEncode.forEach(codec => {
        if (codecs[codec] === undefined) {
          throw new Error('Unknown codec ' + codec + ' in FFmpeg.')
        }

        if (codecs[codec].canEncode !== true) {
          throw new Error('Unavailable encode codec ' + codec + ' in FFmpeg')
        }
      })
    })
}

// We get db by param to not import it in this file (import orders)
function clientsExist (OAuthClient: OAuthClientModel) {
  return OAuthClient.countTotal().then(totalClients => {
    return totalClients !== 0
  })
}

// We get db by param to not import it in this file (import orders)
function usersExist (User: UserModel) {
  return User.countTotal().then(totalUsers => {
    return totalUsers !== 0
  })
}

// ---------------------------------------------------------------------------

export {
  checkConfig,
  checkFFmpeg,
  checkMissedConfig,
  clientsExist,
  usersExist
}
