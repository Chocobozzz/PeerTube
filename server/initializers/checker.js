'use strict'

const config = require('config')
const mongoose = require('mongoose')

const Client = mongoose.model('OAuthClient')
const User = mongoose.model('User')

const checker = {
  checkConfig: checkConfig,
  clientsExist: clientsExist,
  usersExist: usersExist
}

// Check the config files
function checkConfig () {
  const required = [ 'listen.port',
    'webserver.https', 'webserver.host', 'webserver.port',
    'database.host', 'database.port', 'database.suffix',
    'storage.certs', 'storage.uploads', 'storage.logs',
    'network.friends', 'electron.debug' ]
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
  User.list(function (err, users) {
    if (err) return callback(err)

    return callback(null, users.length !== 0)
  })
}

// ---------------------------------------------------------------------------

module.exports = checker
