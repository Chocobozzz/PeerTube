;(function () {
  'use strict'

  var spawn = require('electron-spawn')
  var config = require('config')
  var ipc = require('node-ipc')
  var pathUtils = require('path')

  var logger = require('./logger')

  var host = config.get('webserver.host')
  var port = config.get('webserver.port')

  var nodeKey = 'webtorrentnode' + port
  var processKey = 'webtorrent' + port

  ipc.config.silent = true
  ipc.config.id = nodeKey

  var webtorrentnode = {}

  // Useful for beautiful tests
  webtorrentnode.silent = false

  // Useful to kill it
  webtorrentnode.app = null

  webtorrentnode.create = function (options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    // Override options
    if (options.host) host = options.host
    if (options.port) {
      port = options.port
      nodeKey = 'webtorrentnode' + port
      processKey = 'webtorrent' + port
      ipc.config.id = nodeKey
    }

    ipc.serve(function () {
      if (!webtorrentnode.silent) logger.info('IPC server ready.')

      // Run a timeout of 30s after which we exit the process
      var timeout_webtorrent_process = setTimeout(function () {
        logger.error('Timeout : cannot run the webtorrent process. Please ensure you have electron-prebuilt npm package installed with xvfb-run.')
        process.exit()
      }, 30000)

      ipc.server.on(processKey + '.ready', function () {
        if (!webtorrentnode.silent) logger.info('Webtorrent process ready.')
        clearTimeout(timeout_webtorrent_process)
        callback()
      })

      ipc.server.on(processKey + '.exception', function (data) {
        logger.error('Received exception error from webtorrent process.', { exception: data.exception })
        process.exit()
      })

      var webtorrent_process = spawn(__dirname + '/webtorrent.js', host, port, { detached: true })
      webtorrent_process.stderr.on('data', function (data) {
        // logger.debug('Webtorrent process stderr: ', data.toString())
      })

      webtorrent_process.stdout.on('data', function (data) {
        // logger.debug('Webtorrent process:', data.toString())
      })

      webtorrentnode.app = webtorrent_process
    })

    ipc.server.start()
  }

  webtorrentnode.seed = function (path, callback) {
    var extension = pathUtils.extname(path)
    var basename = pathUtils.basename(path, extension)
    var data = {
      _id: basename,
      args: {
        path: path
      }
    }

    if (!webtorrentnode.silent) logger.debug('Node wants to seed ' + data._id)

    // Finish signal
    var event_key = nodeKey + '.seedDone.' + data._id
    ipc.server.on(event_key, function listener (received) {
      if (!webtorrentnode.silent) logger.debug('Process seeded torrent ' + received.magnetUri)

      // This is a fake object, we just use the magnetUri in this project
      var torrent = {
        magnetURI: received.magnetUri
      }

      ipc.server.off(event_key)
      callback(torrent)
    })

    ipc.server.broadcast(processKey + '.seed', data)
  }

  webtorrentnode.add = function (magnetUri, callback) {
    var data = {
      _id: magnetUri,
      args: {
        magnetUri: magnetUri
      }
    }

    if (!webtorrentnode.silent) logger.debug('Node wants to add ' + data._id)

    // Finish signal
    var event_key = nodeKey + '.addDone.' + data._id
    ipc.server.on(event_key, function (received) {
      if (!webtorrentnode.silent) logger.debug('Process added torrent')

      // This is a fake object, we just use the magnetUri in this project
      var torrent = {
        files: received.files
      }

      ipc.server.off(event_key)
      callback(torrent)
    })

    ipc.server.broadcast(processKey + '.add', data)
  }

  webtorrentnode.remove = function (magnetUri, callback) {
    var data = {
      _id: magnetUri,
      args: {
        magnetUri: magnetUri
      }
    }

    if (!webtorrentnode.silent) logger.debug('Node wants to stop seeding ' + data._id)

    // Finish signal
    var event_key = nodeKey + '.removeDone.' + data._id
    ipc.server.on(event_key, function (received) {
      if (!webtorrentnode.silent) logger.debug('Process removed torrent ' + data._id)

      var err = null
      if (received.err) err = received.err

      ipc.server.off(event_key)
      callback(err)
    })

    ipc.server.broadcast(processKey + '.remove', data)
  }

  module.exports = webtorrentnode
})()
