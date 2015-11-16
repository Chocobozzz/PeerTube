;(function () {
  'use strict'

  var config = require('config')
  var mkdirp = require('mkdirp')

  var checker = {}

  // Check the config files
  checker.checkConfig = function () {
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
  checker.createDirectoriesIfNotExist = function () {
    var storages = config.get('storage')

    for (var key of Object.keys(storages)) {
      var path = storages[key]
      try {
        mkdirp.sync(__dirname + '/../' + path)
      } catch (error) {
        // Do not use logger
        console.error('Cannot create ' + path + ':' + error)
        process.exit(0)
      }
    }
  }

  // ----------- Export -----------
  module.exports = checker
})()
