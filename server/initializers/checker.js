'use strict'

var config = require('config')
var mkdirp = require('mkdirp')
var path = require('path')

var checker = {
  checkConfig: checkConfig,
  createDirectoriesIfNotExist: createDirectoriesIfNotExist
}

// Check the config files
function checkConfig () {
  var required = [ 'listen.port',
    'webserver.https', 'webserver.host', 'webserver.port',
    'database.host', 'database.port', 'database.suffix',
    'storage.certs', 'storage.uploads', 'storage.logs',
    'network.friends' ]
  var miss = []

  for (var key of required) {
    if (!config.has(key)) {
      miss.push(key)
    }
  }

  return miss
}

// Create directories for the storage if it doesn't exist
function createDirectoriesIfNotExist () {
  var storages = config.get('storage')

  for (var key of Object.keys(storages)) {
    var dir = storages[key]
    try {
      mkdirp.sync(path.join(__dirname, '..', dir))
    } catch (error) {
      throw new Error('Cannot create ' + path + ':' + error)
    }
  }
}

// ---------------------------------------------------------------------------

module.exports = checker
