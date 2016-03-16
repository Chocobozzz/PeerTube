'use strict'

const config = require('config')
const mkdirp = require('mkdirp')
const path = require('path')

const checker = {
  checkConfig: checkConfig,
  createDirectoriesIfNotExist: createDirectoriesIfNotExist
}

// Check the config files
function checkConfig () {
  const required = [ 'listen.port',
    'webserver.https', 'webserver.host', 'webserver.port',
    'database.host', 'database.port', 'database.suffix',
    'storage.certs', 'storage.uploads', 'storage.logs',
    'network.friends' ]
  const miss = []

  for (const key of required) {
    if (!config.has(key)) {
      miss.push(key)
    }
  }

  return miss
}

// Create directories for the storage if it doesn't exist
function createDirectoriesIfNotExist () {
  const storages = config.get('storage')

  for (const key of Object.keys(storages)) {
    const dir = storages[key]
    try {
      mkdirp.sync(path.join(__dirname, '..', '..', dir))
    } catch (error) {
      throw new Error('Cannot create ' + path + ':' + error)
    }
  }
}

// ---------------------------------------------------------------------------

module.exports = checker
