import * as config from 'config'

import { database as db } from './database'
import { CONFIG } from './constants'

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
  const miss = []

  for (const key of required) {
    if (!config.has(key)) {
      miss.push(key)
    }
  }

  return miss
}

// Check the available codecs
function checkFFmpeg (callback) {
  const Ffmpeg = require('fluent-ffmpeg')

  Ffmpeg.getAvailableCodecs(function (err, codecs) {
    if (err) return callback(err)
    if (CONFIG.TRANSCODING.ENABLED === false) return callback(null)

    const canEncode = [ 'libx264' ]
    canEncode.forEach(function (codec) {
      if (codecs[codec] === undefined) {
        return callback(new Error('Unknown codec ' + codec + ' in FFmpeg.'))
      }

      if (codecs[codec].canEncode !== true) {
        return callback(new Error('Unavailable encode codec ' + codec + ' in FFmpeg'))
      }
    })

    return callback(null)
  })
}

function clientsExist (callback) {
  db.OAuthClient.countTotal(function (err, totalClients) {
    if (err) return callback(err)

    return callback(null, totalClients !== 0)
  })
}

function usersExist (callback) {
  db.User.countTotal(function (err, totalUsers) {
    if (err) return callback(err)

    return callback(null, totalUsers !== 0)
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
