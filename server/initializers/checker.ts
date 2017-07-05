import * as config from 'config'

import { database as db } from './database'
import { CONFIG } from './constants'
import { promisify0 } from '../helpers/core-utils'

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
    'storage.certs', 'storage.videos', 'storage.logs', 'storage.thumbnails', 'storage.previews',
    'admin.email', 'signup.enabled', 'transcoding.enabled', 'transcoding.threads'
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
function checkFFmpeg () {
  const Ffmpeg = require('fluent-ffmpeg')
  const getAvailableCodecsPromise = promisify0(Ffmpeg.getAvailableCodecs)

  getAvailableCodecsPromise()
    .then(codecs => {
      if (CONFIG.TRANSCODING.ENABLED === false) return undefined

      const canEncode = [ 'libx264' ]
      canEncode.forEach(function (codec) {
        if (codecs[codec] === undefined) {
          throw new Error('Unknown codec ' + codec + ' in FFmpeg.')
        }

        if (codecs[codec].canEncode !== true) {
          throw new Error('Unavailable encode codec ' + codec + ' in FFmpeg')
        }
      })
    })
}

function clientsExist () {
  return db.OAuthClient.countTotal().then(totalClients => {
    return totalClients !== 0
  })
}

function usersExist () {
  return db.User.countTotal().then(totalUsers => {
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
