'use strict'

const config = require('config')
const mongoose = require('mongoose')

const Client = mongoose.model('OAuthClient')
const User = mongoose.model('User')

const checker = {
  checkConfig,
  checkMissedConfig,
  clientsExist,
  usersExist
}

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
    'database.hostname', 'database.port', 'database.suffix',
    'storage.certs', 'storage.videos', 'storage.logs', 'storage.thumbnails'
  ]
  const miss = []

  for (const key of required) {
    if (!config.has(key)) {
      miss.push(key)
    }
  }

  return miss
}

function clientsExist (callback) {
  Client.list(function (err, clients) {
    if (err) return callback(err)

    return callback(null, clients.length !== 0)
  })
}

function usersExist (callback) {
  User.countTotal(function (err, totalUsers) {
    if (err) return callback(err)

    return callback(null, totalUsers !== 0)
  })
}

// ---------------------------------------------------------------------------

module.exports = checker
