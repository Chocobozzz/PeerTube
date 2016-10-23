'use strict'

const config = require('config')
const mongoose = require('mongoose')

const Client = mongoose.model('OAuthClient')
const User = mongoose.model('User')

const checker = {
  checkConfig,
  clientsExist,
  usersExist
}

// Check the config files
function checkConfig () {
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
